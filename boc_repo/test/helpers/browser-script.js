// ==================================================================
// browser-script.js - load a page script into a sandbox.
//
// pages/**/scripts/*.js are ES5 files that declare globals and are loaded
// with <script src>. There is no module system, so nothing can be required.
// This evaluates a file in a vm context with the handful of browser globals
// its top level touches ($(document).ready is the only executable statement
// in the sales scripts) and hands back the context, where every top-level
// `function foo()` is now a property.
//
// Only the pure calculation functions are worth testing this way - anything
// that reaches into the DOM belongs behind a real browser test instead.
//
// Usage:
//   const page = loadBrowserScript("pages/sales/scripts/quotation_add.js");
//   page.calculateLineAmounts({ qty: 2, rate: 100 });
// ==================================================================

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const REPO_ROOT = path.resolve(__dirname, "..", "..");

function createJQueryStub() {
    const node = {};
    const chainable = new Proxy(node, {
        get(target, prop) {
            if (prop === "length") return 0;
            if (prop === "then") return undefined;
            if (prop in target) return target[prop];
            return () => chainable;
        }
    });

    function jq() {
        return chainable;
    }

    jq.ajax = () => chainable;
    jq.each = (collection, iteratee) => {
        (collection || []).forEach((value, index) => iteratee(index, value));
    };
    jq.extend = Object.assign;
    jq.fn = {};

    return jq;
}

function createUnderscoreStub() {
    return {
        each(collection, iteratee) {
            (collection || []).forEach((value, index) => iteratee(value, index, collection));
        },
        map(collection, iteratee) {
            return (collection || []).map(iteratee);
        },
        find(collection, predicate) {
            return (collection || []).find(predicate);
        },
        filter(collection, predicate) {
            return (collection || []).filter(predicate);
        },
        template() {
            return () => "";
        },
        escape(value) {
            return String(value === null || value === undefined ? "" : value);
        }
    };
}

function loadBrowserScript(relativePath, extraGlobals) {
    const filePath = path.resolve(REPO_ROOT, relativePath);
    const code = fs.readFileSync(filePath, "utf8");

    const sandbox = Object.assign({
        $: createJQueryStub(),
        jQuery: undefined,
        _: createUnderscoreStub(),
        document: { readyState: "complete" },
        window: { location: { search: "", href: "" } },
        location: { search: "", href: "" },
        navigator: { userAgent: "node" },
        sessionStorage: {
            store: {},
            getItem(key) { return this.store[key] === undefined ? null : this.store[key]; },
            setItem(key, value) { this.store[key] = String(value); },
            removeItem(key) { delete this.store[key]; }
        },
        localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
        URLSearchParams,
        console,
        setTimeout,
        clearTimeout,
        Math,
        Number,
        String,
        Date,
        JSON,
        isNaN,
        parseInt,
        parseFloat
    }, extraGlobals || {});

    sandbox.jQuery = sandbox.$;
    sandbox.window.document = sandbox.document;
    sandbox.globalThis = sandbox;

    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: filePath });

    return sandbox;
}

module.exports = { loadBrowserScript, REPO_ROOT };
