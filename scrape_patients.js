import puppeteer from 'puppeteer';
import { writeFile } from 'fs/promises';
import fs from 'fs';
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const baseUrl = 'https://demo.openemr.io/openemr';

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  const page = await browser.newPage();
  await page.goto(baseUrl);

  await page.waitForSelector('#authUser');
  await page.type('#authUser', 'admin', { delay: 10 });
  await page.type('#clearPass', 'pass', { delay: 10 });
  await page.click('#login-button');
  await page.waitForNavigation();

  await page.waitForSelector('div.oe-dropdown-toggle');
  await page.click('div.oe-dropdown-toggle');

  await page.waitForSelector('.menuEntries li');
  const items = await page.$$('.menuEntries li');
  await items[1].click();

  for (const item of items) {
    const text = await page.evaluate(el => el.textContent.trim(), item);
    if (text === 'New/Search') {
      await item.click();
      break;
    }
  }

  await page.waitForSelector('iframe[name="pat"]');
  let frameHandle = await page.$('iframe[name="pat"]');
  let frame = await frameHandle.contentFrame();

  await frame.waitForSelector('#search');
  await frame.evaluate(() => {
    const btn = document.querySelector('#search');
    if (btn) {
      btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  await new Promise(resolve => setTimeout(resolve, 1000));
  await frame.click('#search');

  console.log('Button clicked, waiting for results...');
  await page.waitForSelector('iframe#modalframe', { visible: true });

  let modalFrameHandle = await page.$('iframe#modalframe');
  let modalFrame = await modalFrameHandle.contentFrame();

  await modalFrame.waitForSelector('tr.oneresult', { timeout: 5000 });
  console.log('✅ Patient search results found.');

  let rows = await modalFrame.$$('#searchResults tr.oneresult');
  console.log(`Found ${rows.length} rows on the table.`);

  const extractedData = [];

  // STEP 1: Extract summary data
  for (const row of rows) {
    const tdsHandles = await row.$$('td');
    if (tdsHandles.length >= 6) {
      const name = await tdsHandles[0].evaluate(td => td.innerText.trim());
      const phoneNumber = await tdsHandles[2].evaluate(td => td.innerText.trim());
      const dob = await tdsHandles[4].evaluate(td => td.innerText.trim());
      const patientID = await tdsHandles[5].evaluate(td => td.innerText.trim());

      extractedData.push({ name, phoneNumber, dob, patientID });
    }
  }

  console.log('🗂️ Extracted summary data. Now checking medications...');

  // STEP 2: Extract medication details per patient
  for (let i = 0; i < extractedData.length; i++) {
    console.log(`🔎 Checking medications for patient #${i + 1}: ${extractedData[i].name}`);

    rows = await modalFrame.$$('#searchResults tr.oneresult');
    const row = rows[i];

    await row.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    await new Promise(resolve => setTimeout(resolve, 500));
    await row.click();

    await page.waitForSelector('iframe[name="pat"]', { timeout: 5000 });

    try {
      const closeBtn = await page.waitForSelector('.close', { timeout: 3000, visible: true });
      if (closeBtn) {
        await closeBtn.click();
        console.log('ℹ️ Popup closed.');
        await page.waitForTimeout(500);
      }
    } catch {
      console.log('ℹ️ No popup found.');
    }

    const dashboardHandle = await page.$('iframe[name="pat"]');
    const dashboardFrame = await dashboardHandle.contentFrame();

    try {
      const noMedsText = await dashboardFrame.$$eval('div', divs =>
        divs.some(div => div.innerText.includes('Nothing Recorded'))
      );

      if (noMedsText) {
        console.log(`⚠️ No medications recorded for ${extractedData[i].name}`);
        extractedData[i].medications = [];

        // Re-navigate to New/Search menu
        await page.waitForSelector('div.oe-dropdown-toggle');
        await page.click('div.oe-dropdown-toggle');
        await page.waitForSelector('.menuEntries li');
        const items = await page.$$('.menuEntries li');
        await items[1].click();

        for (const item of items) {
          const text = await page.evaluate(el => el.textContent.trim(), item);
          if (text === 'New/Search') {
            await item.click();
            break;
          }
        }

        await page.waitForSelector('iframe[name="pat"]');
        const newSearchFrameHandle = await page.$('iframe[name="pat"]');
        const newSearchFrame = await newSearchFrameHandle.contentFrame();
        await newSearchFrame.waitForSelector('#search');
        await newSearchFrame.click('#search');

        await page.waitForTimeout(1000); // 🧠 give it a moment

        await page.waitForSelector('iframe#modalframe', { visible: true, timeout: 10000 });
        const refreshedModalHandle = await page.$('iframe#modalframe');
        modalFrame = await refreshedModalHandle.contentFrame();
        rows = await modalFrame.$$('#searchResults tr.oneresult');

        continue; // move to next patient
      }

      // ✅ Medications found
      await dashboardFrame.waitForSelector('.list-group-item.p-0.pl-1', { timeout: 4000 });
      const meds = await dashboardFrame.$$eval('.list-group-item.p-0.pl-1', divs =>
        divs.map(div => {
          const span = div.querySelector('span');
          return span?.innerText.trim() || '';
        }).filter(Boolean)
      );

      extractedData[i].medications = meds;

    } catch (e) {
      console.log(`⚠️ Error while checking meds for ${extractedData[i].name}: ${e.message}`);
      extractedData[i].medications = [];

      // Retry from New/Search on any failure
      await page.waitForSelector('div.oe-dropdown-toggle');
      await page.click('div.oe-dropdown-toggle');
      await page.waitForSelector('.menuEntries li');
      const items = await page.$$('.menuEntries li');
      await items[1].click();

      for (const item of items) {
        const text = await page.evaluate(el => el.textContent.trim(), item);
        if (text === 'New/Search') {
          await item.click();
          break;
        }
      }

      await page.waitForSelector('iframe[name="pat"]');
      const newSearchFrameHandle = await page.$('iframe[name="pat"]');
      const newSearchFrame = await newSearchFrameHandle.contentFrame();
      await newSearchFrame.waitForSelector('#search');
      await newSearchFrame.click('#search');

      await wait(1000);

      await page.waitForSelector('iframe[name="pat"]]', { visible: true, timeout: 10000 });
      const refreshedModalHandle = await page.$('iframe[name="pat"]');
      modalFrame = await refreshedModalHandle.contentFrame();
      rows = await modalFrame.$$('#searchResults tr.oneresult');

      continue;
    }

  }
 // ✅ close for-loop

  
  console.log('✅ All patient data collected:', extractedData);

  fs.writeFile('./data/patients.json', JSON.stringify(extractedData, null, 2), (err) => {
    if (err) throw err;
    console.log('💾 File saved successfully!');
  });

  await browser.close();
  
})();
