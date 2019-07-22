const puppeteer = require('puppeteer');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const Table = require('cli-table');
const chalk = require('chalk');
const prompts = require('prompts');
const fs = require('fs');

const config = require('./config.json');

if (!config.username || !config.password) {
  const questions = [
    {
      type: 'text',
      name: 'username',
      message: 'Qual seu usuário UCS?'
    },
    {
      type: 'password',
      name: 'password',
      message: 'Qual sua senha UCS?'
    }
  ];

  (async () => {
    const response = await prompts(questions);
    config.username = response.username;
    config.password = response.password;

    fs.writeFile('config.json', JSON.stringify(config, null, 2), 'utf8', (err) => {
      if (err) {
        return console.log(chalk.red('Erro ao configurar usuário!'));
      }

      console.log("\n");
      return console.log(chalk.green('Usuário configurado com sucesso!'));
    });
  })();

} else {

  (async () => {
    const browser = await puppeteer.launch();
    const pageLogin = await browser.newPage();
    await pageLogin.goto(config.urlLogin);
    await pageLogin.type('#id-username', config.username);
    await pageLogin.type('#id-password', config.password);
    await pageLogin.click('input[type="submit"]');
    await pageLogin.waitForNavigation();
    await pageLogin.close();

    const pageNotas = await browser.newPage();
    await pageNotas.goto(config.urlNotes, {
      waitUntil: 'domcontentloaded'
    }).catch(e => {
        console.log('Erro ao carregar página da UCS: ' + e);
        process.exit(1);
    });

    let pageHtml = await pageNotas.content();
    let doc = new JSDOM(pageHtml).window.document;

    // Busca tabelas de avaliações
    let tableNotes = doc.querySelectorAll('table[cellspacing="2px"]');
    for (var table of tableNotes) {
      var tableOut = new Table({
        style: {
          head: ['green'],
          compact : true
        },
        head: ['Avaliação', 'Nota', 'Observação'],
        colWidths: [25, 10, 25],
      });

      // Imprime nome da disciplina
      console.log(chalk.cyan(' '+table.previousElementSibling.previousElementSibling.textContent.trim()));

      // Busca notas
      let trs = table.querySelectorAll('tbody tr.colleft');
      for (var tr of trs) {
        let content = [];
        tr.querySelectorAll('td').forEach((td) => {
          content.push(td.textContent.trim());
        });
        tableOut.push(content);
      }

      // Adiciona linha para dividir notas do resultados finais
      tableOut.push(["", "", ""]);

      // Busca resultados finais (ultimas 3 linhas da tabela)
      table.querySelectorAll('tbody tr:nth-last-child(-n+3)').forEach((tr) => {
        let content = [];
        tr.querySelectorAll('td').forEach((td) => {
          content.push(chalk.bold.italic(td.textContent.trim()));
        });

        // Como resultados finais não possuem observação preenche em branco
        content[2] = "";
        tableOut.push(content);
      });

      console.log(tableOut.toString());
      console.log("\n");
    }

    await browser.close();
  })();
}

return true;
