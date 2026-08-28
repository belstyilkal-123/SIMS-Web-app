import { JSDOM } from 'jsdom';
(async () => {
  const dom = await JSDOM.fromURL("http://localhost:4173/", {
    runScripts: "dangerously",
    resources: "usable"
  });
  
  dom.window.console.error = (...args) => console.log('ERROR:', ...args);
  dom.window.addEventListener("error", (event) => {
    console.log("JSDOM ERROR:", event.error?.message || event.message);
  });
  dom.window.addEventListener("unhandledrejection", (event) => {
    console.log("JSDOM PROMISE REJECTION:", event.reason?.message || event.reason);
  });
  
  await new Promise(r => setTimeout(r, 5000));
  console.log("Done waiting.");
})();
