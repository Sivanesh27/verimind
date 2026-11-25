export class LlmRefusalError extends Error {
  constructor(category) {
    super(`Model declined the request${category ? ` (${category})` : ''}`);
    this.category = category;
  }
}
