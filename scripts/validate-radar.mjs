import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const load = path => JSON.parse(readFileSync(path, "utf8"));
const index = load("data/index.json");
const history = load("data/history.json");
const ids = [
  "economic_engine","critical_dependencies","external_demand_trade","strategic_industry_transition",
  "investment_capital_direction","fiscal_infrastructure_capacity","execution_adaptability",
  "demography_labour","household_relocation","social_political_talent"
];
const isoDate = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value + "T12:00:00Z"));
const monthIds = index.months.map(m=>m.id);
assert.equal(monthIds.length,36,"Exactly 36 visible months");
assert.equal(new Set(monthIds).size,36,"Monthly index must not repeat months");
assert.deepEqual([...monthIds].sort((a,b)=>b.localeCompare(a)),monthIds,"Months newest-first");
assert.equal(index.latest,monthIds[0],"Latest month must be first");

const current = load("data/" + index.months[0].file);
const mainIds = current.countries.map(c=>c.id);
assert.equal(mainIds.length,24,"Expected 24 canonical main countries");
assert.equal(new Set(mainIds).size,24,"Main country IDs must be unique");
assert.equal(current.potential_countries.length,5,"Latest potential radar requires five countries");

let checkedFiles=0, checkedSignals=0, undated=0, unavailable=0;
for (const month of index.months){
  if(month.historical){
    assert.ok(month.id>=history.range.start && month.id<=history.range.end,"Historical month out of range: " + month.id);
    continue;
  }
  for(const lang of ["tr","en","de"]){
    const file=month.file.replace(/\.json$/,lang==="tr"?".json":"."+lang+".json");
    const d=load("data/"+file);
    checkedFiles++;
    assert.equal(d.meta.month_id,month.id);
    assert.equal(d.meta.country_count,d.countries.length);
    assert.equal(d.meta.potential_country_count,d.potential_countries.length);
    assert.equal(d.meta.signal_count,10);
    assert.ok(isoDate(d.meta.checked_date),"Invalid update date: "+file);
    const all=[...d.countries,...d.potential_countries];
    const allIds=all.map(c=>c.id);
    assert.equal(allIds.length,new Set(allIds).size,"Duplicate country in "+file);
    assert.equal(d.countries.length,24,"Missing country in "+file);
    assert.deepEqual(d.countries.map(c=>c.id),mainIds,"Main countries changed in "+file);
    if(month.id===index.latest)assert.equal(d.potential_countries.length,5);
    for(const c of all){
      assert.match(c.map_id,/^\d{3}$/,"Invalid map code: "+c.id+" / "+file);
      assert.ok(c.name&&c.flag,"Missing country name/flag: "+c.id+" / "+file);
      assert.equal(c.items.length,10,"Expected 10 signals: "+c.id+" / "+file);
      assert.deepEqual(c.items.map(item=>item.signal_id),ids,"Signal order mismatch: "+c.id+" / "+file);
      if(d.potential_countries.includes(c))assert.ok(c.selection_reason,"Potential reason missing: "+c.id+" / "+file);
      for(const signal of c.items){
        checkedSignals++;
        assert.ok(["positive","neutral","negative","unavailable"].includes(signal.status),"Invalid status");
        assert.ok(signal.development&&signal.impact&&signal.signal,"Missing signal text");
        if(signal.status==="unavailable"){
          unavailable++;
          assert.ok(c.historical_unavailable,"Unverified status must be explicitly marked: "+c.id);
          assert.equal(signal.source?.url||"","");
          continue;
        }
        assert.ok(/^https?:\/\//.test(signal.source?.url||""),"Missing source URL: "+c.id+" "+file);
        assert.ok(signal.source?.name,"Missing source name: "+c.id+" "+file);
        if(!signal.source?.date){undated++;continue}
        assert.ok(isoDate(signal.source.date),"Invalid source date");
        assert.ok(signal.source.date<=d.meta.checked_date,"Source after archive as-of date: "+c.id+" / "+file);
        if(signal.checked_date)assert.ok(signal.source.date<=signal.checked_date,"Source after item check: "+c.id+" / "+file);
      }
    }
  }
  const tr=load("data/"+month.file);
  for(const lang of ["en","de"]){
    const trans=load("data/"+month.file.replace(/\.json$/,"."+lang+".json"));
    for(const section of ["countries","potential_countries"]){
      for(let i=0;i<tr[section].length;i++){
        const a=tr[section][i],b=trans[section][i];
        assert.equal(a.id,b.id,"Country ID translation mismatch");
        assert.equal(a.map_id,b.map_id,"Map code translation mismatch");
        for(let j=0;j<10;j++){
          const x=a.items[j],y=b.items[j];
          assert.equal(x.signal_id,y.signal_id,"Signal ID translation mismatch");
          assert.equal(x.status,y.status,"Status translation mismatch");
          assert.deepEqual(x.source,y.source,"Source translation mismatch");
          assert.equal(x.checked_date,y.checked_date,"Check date translation mismatch");
        }
      }
    }
  }
}
assert.equal(history.countries.length,24,"Historical reconstruction must include all 24 main countries");
assert.deepEqual(history.countries.map(c=>c.id),mainIds,"Historical country IDs out of sync");
for(const c of history.countries){
  for(const p of history.periods){
    const code=c.periods?.[p.id];
    assert.ok(/^[pnxu]{10}$/.test(code||""),"Historical code must have ten valid values: "+c.id+" "+p.id);
    if(c.id==="japan"||c.id==="hungary")assert.equal(code,"uuuuuuuuuu","Do not invent historical signals for "+c.id);
  }
}
const html=readFileSync("index.html","utf8");
for(const cls of ["trend-layout","trend-rail","trend-month-scroll","trend-month-grid"]){
  assert.ok(html.includes(cls),"Missing monthly-map component: "+cls);
}
assert.ok(!html.includes(".trend-grid .trend-axis{"),"Legacy sticky-grid overrides detected");
console.log("PASS Country Radar integrity checks");
console.log(JSON.stringify({months:monthIds.length,canonicalCountries:mainIds.length,languageFiles:checkedFiles,
  checkedSignals,undatedSources:undated,explicitUnavailableSignals:unavailable},null,2));
