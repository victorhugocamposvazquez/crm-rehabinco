import { registrarAdapter } from "../registry.js";
import { pisosAdapter } from "./adapter.js";

registrarAdapter(pisosAdapter);

export { pisosAdapter, totalAnunciosEnFixture } from "./adapter.js";
