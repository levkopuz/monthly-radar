import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.RADAR_BASE_URL || "http://127.0.0.1:8765";
const browser = await chromium.launch({headless:true,args:["--no-sandbox"]});
const results=[];
try {
  for(const {width,height,lang} of [
    {width:390,height:844,lang:"tr"},
    {width:1440,height:900,lang:"en"},
    {width:320,height:720,lang:"de"}
  ]){
    const context=await browser.newContext({viewport:{width,height},isMobile:width<700,hasTouch:width<700});
    const page=await context.newPage();
    const errors=[];
    page.on("pageerror",error=>errors.push(error.message));
    try{
      const response=await page.goto(base,{waitUntil:"domcontentloaded",timeout:30000});
      assert.equal(response.status(),200,"Website must respond 200");
      await page.locator(".trend-layout").waitFor({timeout:35000});
      await page.locator("#languageSelect").selectOption(lang);
      const countryName={tr:"İngiltere",en:"United Kingdom",de:"Vereinigtes Königreich"}[lang];
      await page.waitForFunction(name=>
        document.querySelector("#trendCountry")?.textContent.includes(name) &&
        document.querySelectorAll(".trend-month-grid .trend-cell").length===360 &&
        document.querySelectorAll(".country-chip[data-country-id]").length===24,
        countryName,{timeout:35000});
      assert.equal(await page.locator(".country-chip[data-country-id]").count(),24,"Latest main-country count");
      assert.equal(await page.locator(".trend-month-grid .trend-cell").count(),360,"36 months × 10 signals");

      const rail=page.locator(".trend-rail"),scroller=page.locator(".trend-month-scroll");
      const before=await rail.boundingBox();
      const info=await scroller.evaluate(el=>{
        const first=el.scrollLeft;el.scrollLeft=700;
        return {first,after:el.scrollLeft,max:el.scrollWidth-el.clientWidth,overflow:getComputedStyle(el).overflowX};
      });
      const after=await rail.boundingBox();
      assert.ok(Math.abs(before.x-after.x)<1,"Signal labels must remain fixed");
      assert.ok(info.max>300&&info.after>info.first,"Month matrix must scroll independently");
      assert.equal(await rail.evaluate(el=>getComputedStyle(el).backgroundColor),"rgb(17, 17, 15)","Fixed rail must be opaque");

      await page.locator('.tab[data-mode="potential"]').click();
      await page.waitForFunction(()=>document.querySelectorAll(".country-chip[data-country-id]").length===5);
      await page.locator('.tab[data-mode="all"]').click();
      await page.waitForFunction(()=>document.querySelectorAll(".country-chip[data-country-id]").length===24);
      await page.locator("#yearSelect").selectOption("2025");
      await page.locator("#monthSelect").selectOption("2025-06");
      await page.waitForFunction(()=>document.getElementById("detailSubtitle")?.textContent.includes("2025"));
      await page.locator('.country-chip[data-country-id="japan"]').click();
      await page.waitForFunction(()=>document.getElementById("trendCountry")?.textContent.includes("Japan")||document.getElementById("trendCountry")?.textContent.includes("Japonya"));
      assert.equal(await page.locator(".status-badge").count(),10,"Historical ten signals must render");
      assert.equal(await page.locator(".trend-month-grid .trend-cell").count(),360,"Historical month matrix must remain consistent");
      assert.deepEqual(errors,[],"No uncaught page errors");
      results.push({width,lang,ok:true});
    }finally{await context.close()}
  }
}finally{await browser.close()}
console.log("PASS responsive Country Radar browser tests",JSON.stringify(results));
