/**
 * Script para gerar icon-192.png e icon-512.png do PressãoApp
 * Uso: node generate-icons.cjs
 */
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function gerarIcone(tamanho, destino) {
  const canvas = createCanvas(tamanho, tamanho);
  const ctx = canvas.getContext('2d');

  // Fundo azul escuro (cor primária do app)
  const grad = ctx.createLinearGradient(0, 0, tamanho, tamanho);
  grad.addColorStop(0, '#172554');
  grad.addColorStop(1, '#1E3A8A');
  ctx.fillStyle = grad;
  ctx.beginPath();
  const radius = tamanho * 0.22;
  ctx.moveTo(radius, 0);
  ctx.lineTo(tamanho - radius, 0);
  ctx.arcTo(tamanho, 0, tamanho, radius, radius);
  ctx.lineTo(tamanho, tamanho - radius);
  ctx.arcTo(tamanho, tamanho, tamanho - radius, tamanho, radius);
  ctx.lineTo(radius, tamanho);
  ctx.arcTo(0, tamanho, 0, tamanho - radius, radius);
  ctx.lineTo(0, radius);
  ctx.arcTo(0, 0, radius, 0, radius);
  ctx.closePath();
  ctx.fill();

  // Emoji/símbolo do coração com pressão
  const emoji = '🩺';
  const fontSize = Math.round(tamanho * 0.52);
  ctx.font = `${fontSize}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, tamanho / 2, tamanho / 2);

  // Salvar
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(destino, buffer);
  console.log(`✅ Gerado: ${destino} (${tamanho}x${tamanho})`);
}

const publicDir = path.join(__dirname, 'public');
try {
  gerarIcone(192, path.join(publicDir, 'icon-192.png'));
  gerarIcone(512, path.join(publicDir, 'icon-512.png'));
} catch (err) {
  console.error('Erro ao gerar ícones (canvas não instalado?):', err.message);
  console.log('Instalando canvas... tente: npm install canvas e rode novamente.');
}
