
/**
 * vectorStore.js — wrapper para memória vetorial.
 * Produção: substitua os stubs por Pinecone (ou Firebase Extension GoogleAI Semantic Search).
 */
export async function getVectorStore() {
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
