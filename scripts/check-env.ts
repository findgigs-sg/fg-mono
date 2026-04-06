// Eagerly imports env modules to trigger validation.
// Used in deploy workflow to catch missing env vars before building.
import "../apps/web/src/env";
