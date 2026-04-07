const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para servir arquivos estáticos (HTML, CSS, Imagens)
// Colocaremos o index.html e as imagens dentro de uma pasta chamada 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Exemplo de rota de API (para futuras integrações com Apps Script ou Banco de Dados)
app.get('/api/status', (req, res) => {
    res.json({ 
        status: "online", 
        timestamp: new Date(),
        empresa: "MAJB Sistemas" 
    });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});