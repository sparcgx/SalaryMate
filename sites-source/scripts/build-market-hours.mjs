import {readFile,writeFile} from 'node:fs/promises';
const source=(await readFile(new URL('../server/market-hours.mjs',import.meta.url),'utf8')).replace(/^export /gm,'');
await writeFile(new URL('../dist/dev/v5.0.0-dev.2/market-hours.js',import.meta.url),`// Generated from server/market-hours.mjs.\n(function(root){\n${source}\nroot.SalaryMateMarketHours=Object.freeze({MARKET_CALENDARS,MARKET_ZONES,marketLocal,zonedMarketTime,calendarValid,mergeMarketCalendars,marketSession,marketPlan,parseNasdaqTime,quoteTiming});\n})(globalThis);\n`);
