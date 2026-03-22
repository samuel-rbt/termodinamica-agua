# Tabelas Termodinâmicas e Ciclo de Rankine

Ferramenta de engenharia interativa desenvolvida em React. Realiza consultas às 4 tabelas termodinâmicas fundamentais da água, utilizando **interpolação quadrática (Polinômio de Lagrange)** para garantir precisão física, e plota dinamicamente o Diagrama T-s do Ciclo de Rankine.

---

## ⚙️ Escopo de Dados

- **Água saturada por temperatura:** 0.01 – 374.14 °C  
- **Água saturada por pressão:** 0.006 – 220.9 bar  
- **Vapor superaquecido:** 7 faixas de pressão  
- **Líquido comprimido:** 4 faixas de pressão  

---

## 📁 Estrutura de Arquivos (O que faz o quê?)

- `src/data.js`:  
  O banco de dados. Contém as matrizes (arrays) brutas com os valores extraídos das tabelas termodinâmicas oficiais (P, T, v, h, s).

- `src/App.jsx`:  
  O motor matemático e a interface principal. Contém a lógica de busca e a função `interpQuad` responsável pela interpolação polinomial de 2º grau. Renderiza as abas e a tabela de resultados.

- `src/RankineChart.jsx`:  
  O motor gráfico. Utiliza `Chart.js` para desenhar a Cúpula de Saturação da água e plota o Ciclo Ideal de Rankine reativamente, ajustando o teto do ciclo ($T_{max}$) de acordo com a pesquisa do usuário no App.

- `src/App.module.css`:  
  Folha de estilos isolada (CSS Modules) para garantir que o design da aplicação não quebre.

- `src/main.jsx`:  
  Ponto de entrada do React no DOM (injeta o App no `index.html`).

- `package.json`:  
  Mapeamento das dependências do Node.js (Vite, React, Chart.js).

---

## 🚀 Como instalar em um novo PC a partir do Git

Para rodar este projeto em outra máquina, certifique-se de ter o **Node.js** instalado. Ele já inclui o `npm`, necessário para gerenciar os pacotes.

### 1. Clone o repositório

```bash
git clone <URL_DO_SEU_REPOSITORIO>
cd termodinamica
```

### 2. Instale as dependências

Isso criará a pasta `node_modules` com o React e o Chart.js isolados no ambiente do projeto:

```bash
npm install
```

### 3. Inicie o servidor de desenvolvimento

```bash
npm run dev
```

### 4. Acesse no navegador

O terminal mostrará um link (geralmente):

```
http://localhost:5173
```

---

## 🏗️ Build para Produção

Se quiser compilar o código para colocar em um servidor real:

```bash
npm run build
```

##  Render

Site disponivel na plataforma SAS Render

---

## 📌 Observações

- Projeto focado em precisão numérica com interpolação de segunda ordem.
- Ideal para estudos de Termodinâmica e análise de ciclos de potência.
- Totalmente client-side (sem backend).
