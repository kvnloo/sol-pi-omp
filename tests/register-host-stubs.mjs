import { register } from "node:module";
import { pathToFileURL } from "node:url";

register(new URL("./stub-loader.mjs", import.meta.url));
