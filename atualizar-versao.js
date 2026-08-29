const fs = require('fs');
const path = require('path');

console.log('🔄 Iniciando atualização de versão...');

// 1. Lê o arquivo package.json
const packagePath = path.join(__dirname, 'package.json');
const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// 2. Separa a versão atual (ex: "1.0.0" vira [1, 0, 0])
let versionParts = packageData.version.split('.').map(Number);

// 3. Aumenta o último número (Patch - para correções e pequenas melhorias)
versionParts[2] += 1;
const newVersion = versionParts.join('.');

// 4. Salva o package.json com a nova versão
packageData.version = newVersion;
fs.writeFileSync(packagePath, JSON.stringify(packageData, null, 2), 'utf8');
console.log(`✔️ package.json atualizado para: v${newVersion}`);

// 5. Aponta DIRETAMENTE para o index.html dentro da pasta public
const indexPath = path.join(__dirname, 'public', 'index.html');

if (fs.existsSync(indexPath)) {
  let htmlContent = fs.readFileSync(indexPath, 'utf8');
  
  // Procura pela tag <span id="app-version"> e troca a numeração
  const regex = /(<span[^>]*id="app-version"[^>]*>)[\s\S]*?(<\/span\s*>)/gi;
  
  if (regex.test(htmlContent)) {
    htmlContent = htmlContent.replace(regex, `$1v${newVersion}$2`);
    fs.writeFileSync(indexPath, htmlContent, 'utf8');
    console.log(`✔️ Versão atualizada perfeitamente no arquivo public/index.html!`);
  } else {
    console.log('⚠️ Aviso: A tag <span id="app-version"> não foi encontrada no public/index.html. Certifique-se de que ela está lá e o arquivo foi salvo.');
  }
} else {
  console.log(`❌ Erro: O arquivo não foi encontrado no caminho: ${indexPath}`);
}

console.log('🚀 Versionamento concluído com sucesso!');