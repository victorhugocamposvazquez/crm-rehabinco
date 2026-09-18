import { registrarAdapter } from "../registry.js";
import { fotocasaAdapter } from "./adapter.js";

registrarAdapter(fotocasaAdapter);

export { fotocasaAdapter, totalAnunciosEnFixture } from "./adapter.js";
