import { registrarAdapter } from "../registry.js";
import { habitacliaAdapter } from "./adapter.js";

registrarAdapter(habitacliaAdapter);

export { habitacliaAdapter, contactoTipoPortal, totalAnunciosEnJson } from "./adapter.js";
