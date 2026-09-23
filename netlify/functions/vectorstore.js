/**
 * vectorstore.js — wrapper para memória vetorial (STUB).
 * Produção: substitua os stubs por Pinecone (ou Firebase Extension GoogleAI Semantic Search).
 *
 * Observação: por estar em netlify/functions/, o Netlify também publica este arquivo
 * como a função /.netlify/functions/vectorstore. O `handler` abaixo apenas responde
 * 501 para que uma chamada direta não quebre a função.
 */
async function getVectorStore() {
  return {
    async upsert(uid, text, metadata = {}) {
      // TODO: enviar para Pinecone/Ext
      return true;
    },
    async search(uid, query, topK = 5) {
      // TODO: consultar Pinecone/Ext
      return [];
    }
  };
}

async function handler() {
  return {
    statusCode: 501,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ error: 'Vector store não implementado (stub).' })
  };
}

module.exports = { getVectorStore, handler };
