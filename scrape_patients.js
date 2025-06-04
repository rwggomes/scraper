import puppeteer from 'puppeteer';
import { writeFile } from 'fs/promises'; //deixei aqui porque o homem do usou pra retornar os dados

const baseUrl = 'https://demo.openemr.io/openemr';

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized'] //Senão o menu fica escondido
  },
  );
//Login
  const page = await browser.newPage();
  await page.goto(baseUrl)
  await page.waitForSelector('#authUser');
  await page.type('#authUser', 'admin', { delay: 100 });
  await page.type('#clearPass', 'pass', { delay: 100 });
  await page.click('#login-button');

  await page.waitForNavigation();
  await page.waitForSelector('div.oe-dropdown-toggle');
  await page.click('div.oe-dropdown-toggle');

  // Espera o menu abrir
  await page.waitForSelector('.menuEntries li');
  const items = await page.$$('.menuEntries li');

  await items[1].click(); // segundo item
  for (const item of items) {
    const text = await page.evaluate(el => el.textContent.trim(), item);
    if (text === 'New/Search') {
      await item.click();
      break;
    }
  } 
 

  // o meu código era:
  //  await page.waitForSelector('#search');
  // await page.click('#search');, mas o #search não aparecia 


  //Daqui pra frente é GPT 
  
  // Aguarda até o iframe estar presente no DOM
  await page.waitForFunction(() => {
    return document.querySelector('#framesDisplay > div:nth-child(3) > iframe');
  }, { timeout: 30000 });

  // Pega o iframe com evaluateHandle (sem usar $)
  const iframeHandle = await page.evaluateHandle(() => {
    return document.querySelector('#framesDisplay > div:nth-child(3) > iframe');
  });

  const elementHandle = iframeHandle.asElement();
  const frame = await elementHandle.contentFrame();

  if (!frame) {
    throw new Error('Não foi possível acessar o conteúdo do iframe.');
  }

  // Tenta encontrar o botão #search dentro do iframe até 10 vezes
  let searchButtonFound = false;
  for (let i = 0; i < 10; i++) {
    const found = await frame.evaluate(() => {
      return !!document.querySelector('#search');
    });

    if (found) {
      searchButtonFound = true;
      break;
    }

    await page.waitForTimeout(1000); // espera 1 segundo e tenta novamente
  }

  if (!searchButtonFound) {
    throw new Error('O botão #search não apareceu dentro do iframe.');
  }

  // Aguarda o botão ficar visível e clica
  await frame.waitForSelector('#search', { visible: true });
  await frame.click('#search');

  await browser.close();
})();