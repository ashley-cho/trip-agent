import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

mkdirSync("shots", { recursive: true });
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1180, height: 1000 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", e => errors.push("pageerror: " + e.message));
page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });

const shot = async (name, full = false) => {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `shots/${name}.png`, fullPage: full });
  console.log("  shot", name);
};
const chip = async (label) => {
  await page.getByRole("button", { name: label, exact: false }).first().click();
};

await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await shot("1-home");

console.log("step: opening");
await page.getByRole("button", { name: "I need a vacation. Surprise me." }).click();
await page.waitForTimeout(1200);
await shot("2-duration");

console.log("step: duration");
await page.getByRole("button", { name: "5–7 days" }).click();
await page.waitForTimeout(1200);

console.log("step: vibes");
for (const v of ["Exploration", "Relaxation", "Food & drink"]) {
  await page.getByRole("button", { name: new RegExp(v) }).first().click();
}
await shot("3-vibes");
await page.getByRole("button", { name: "That's it" }).click();
await page.waitForTimeout(1200);

console.log("step: budget");
await page.getByRole("button", { name: "$2,000–3,000" }).click();
await page.waitForTimeout(2000);
await shot("4-recommendation", true);

console.log("step: show trip");
await page.getByRole("button", { name: "Show me the trip" }).click();
await page.waitForTimeout(1200);
await shot("5-itinerary", true);

console.log("step: edit — too busy");
await page.getByRole("button", { name: "This feels too busy" }).click();
await page.waitForTimeout(2000);

console.log("step: edit — more wine");
await page.getByRole("button", { name: "More wine" }).click();
await page.waitForTimeout(2000);
await shot("6-after-edits", true);

const text = await page.locator("body").innerText();
console.log("\n--- errors ---");
console.log(errors.length ? errors.join("\n") : "none");
console.log("\n--- agent said ---");
for (const line of text.split("\n").slice(0, 40)) if (line.trim()) console.log("  " + line);
await browser.close();
