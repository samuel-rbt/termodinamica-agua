# Tabelas Termodinâmicas e Diagrama T-s (H₂O)

Este projeto é uma ferramenta de engenharia interativa desenvolvida em **React** para consulta de propriedades termodinâmicas da água. Ele permite visualizar o estado do sistema em um diagrama T-s dinâmico, comparando-o com os ciclos de Rankine e Carnot.

---

## 🛠️ Tecnologias e Bibliotecas

O projeto utiliza as seguintes tecnologias:

- **React (v18)**: Biblioteca base para a interface e lógica de estado.
- **Vite**: Ferramenta de build e servidor de desenvolvimento de alta performance.
- **D3.js**: Utilizada para a renderização matemática e visual do Diagrama T-s, incluindo a cúpula de saturação e os ciclos térmicos.
- **CSS Modules**: Para estilização isolada dos componentes.

---

## 🚀 Como instalar e rodar (Guia para Clonagem)

Certifique-se de ter o **Node.js** instalado em sua máquina antes de começar.

### 1. Clone o repositório
```bash
git clone <URL_DO_REPOSITORIO>
cd <NOME_DA_PASTA>
```

### 2. Instale as dependências
Este comando instalará o React, o D3.js e as ferramentas de desenvolvimento necessárias:

```bash
npm install
```

### 3. Inicie o servidor de desenvolvimento
```bash
npm run dev
```

### 4. Acesse a aplicação
Abra o seu navegador e acesse o endereço indicado no terminal (geralmente http://localhost:5173).

---

## 📁 Estrutura do Projeto

- `src/data.js`: Contém os dados brutos das tabelas de saturação, vapor superaquecido e líquido comprimido.
- `src/App.jsx`: Lógica principal de busca, interpolação de Lagrange e cálculo de estado termodinâmico.
- `src/RankineChart.jsx`: Componente responsável pela plotagem do gráfico T-s usando D3.js.
- `src/App.module.css`: Estilos específicos da interface principal.
- `src/index.css`: Estilos globais e definições de variáveis de cores/fontes.
- `src/main.jsx`: Ponto de entrada da aplicação.

---

## 🏗️ Build para Produção

Para gerar uma versão otimizada para hospedagem (como no Render ou Vercel):

```bash
npm run build
```

---

## 📌 Créditos

**Desenvolvido por:** Murilo Roberto Matias da Silva  
**Matrícula:** 30313473  

---

## 📚 Resumo das Bibliotecas Utilizadas

1. **React**: Gerencia a interface e os inputs de busca.  
2. **D3.js**: Faz todo o trabalho pesado de desenho vetorial (SVG) da cúpula de saturação e dos ciclos.  
3. **Vite**: Gerencia o empacotamento do código para que ele rode rápido no navegador.  

---

## 🧪 Script opcional para gerar o README

Você pode criar o arquivo automaticamente com Python:

```python
import os

readme_content = """# Tabelas Termodinâmicas e Diagrama T-s (H₂O)

Este projeto é uma ferramenta de engenharia interativa desenvolvida em **React** para consulta de propriedades termodinâmicas da água. Ele permite visualizar o estado do sistema em um diagrama T-s dinâmico, comparando-o com os ciclos de Rankine e Carnot.

## 🛠️ Tecnologias
- React
- Vite
- D3.js
- CSS Modules

## 🚀 Como rodar
npm install
npm run dev
"""

with open("README.md", "w", encoding="utf-8") as f:
    f.write(readme_content)

print("README.md criado com sucesso!")
```