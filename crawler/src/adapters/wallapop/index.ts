import { registrarAdapter } from "../registry.js";
import { wallapopAdapter } from "./adapter.js";

registrarAdapter(wallapopAdapter);

export { wallapopAdapter, totalAnunciosEnFixture } from "./adapter.js";
