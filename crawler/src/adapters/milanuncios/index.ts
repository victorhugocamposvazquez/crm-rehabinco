import { registrarAdapter } from "../registry.js";
import { milanunciosAdapter } from "./adapter.js";

registrarAdapter(milanunciosAdapter);

export { milanunciosAdapter, totalAnunciosEnFixture } from "./adapter.js";
