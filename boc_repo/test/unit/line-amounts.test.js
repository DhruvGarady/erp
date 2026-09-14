// Unit tests for calculateLineAmounts - the money maths behind every
// quotation and sales order line.
//
// This function lives in the page scripts, not the backend: the browser
// computes gross/discount/tax/line_total and the API stores whatever it is
// sent (buildQuotationItem/buildSalesOrderItem only apply dbValue defaults).
// That makes these two copies the ONLY implementation of the pricing rules in
// the product, which is exactly why they are worth a test.
//
// The scripts are ES5 globals with no module system, so they are evaluated in
// a vm sandbox - see test/helpers/browser-script.js.

const { describe, test } = require("node:test");
const assert = require("node:assert");

const { loadBrowserScript } = require("../helpers/browser-script");

const quotationPage = loadBrowserScript("pages/sales/scripts/quotation_add.js");
const salesOrderPage = loadBrowserScript("pages/sales/scripts/salesorder_add.js");

const PAGES = [
    { label: "quotation_add.js", calculate: quotationPage.calculateLineAmounts },
    { label: "salesorder_add.js", calculate: salesOrderPage.calculateLineAmounts }
];

// Rules the two copies genuinely share.
PAGES.forEach(({ label, calculate }) => {
    describe(`calculateLineAmounts - shared rules (${label})`, () => {
        test("gross is qty x rate and flows into taxable when there is no discount", () => {
            const line = calculate({ qty: 2, rate: 100 });

            assert.equal(line.gross_amount, 200);
            assert.equal(line.discount_amount, 0);
            assert.equal(line.taxable_amount, 200);
            assert.equal(line.line_total, 200);
        });

        test("missing qty/rate are treated as zero rather than NaN", () => {
            const line = calculate({});

            assert.equal(line.gross_amount, 0);
            assert.equal(line.taxable_amount, 0);
            assert.equal(line.line_total, 0);
            assert.ok(!Number.isNaN(line.line_total));
        });

        test("string inputs from the DOM are coerced", () => {
            const line = calculate({ qty: "2", rate: "99.50" });

            assert.equal(line.gross_amount, 199);
            assert.equal(line.line_total, 199);
        });

        test("a PERCENT discount is taken off the gross", () => {
            const line = calculate({ qty: 2, rate: 100, discount_type: "PERCENT", discount_value: 10 });

            assert.equal(line.discount_amount, 20);
            assert.equal(line.taxable_amount, 180);
        });

        test("an AMOUNT discount is taken literally", () => {
            const line = calculate({ qty: 2, rate: 100, discount_type: "AMOUNT", discount_value: 50 });

            assert.equal(line.discount_amount, 50);
            assert.equal(line.taxable_amount, 150);
        });

        test("an unknown or missing discount_type means no discount", () => {
            [undefined, "", "FLAT", "percent"].forEach((discountType) => {
                const line = calculate({ qty: 2, rate: 100, discount_type: discountType, discount_value: 10 });
                assert.equal(line.discount_amount, 0, `discount_type ${JSON.stringify(discountType)}`);
                assert.equal(line.taxable_amount, 200);
            });
        });

        test("the discount is capped at the gross - a line can never go negative", () => {
            const overAmount = calculate({ qty: 1, rate: 100, discount_type: "AMOUNT", discount_value: 250 });
            assert.equal(overAmount.discount_amount, 100);
            assert.equal(overAmount.taxable_amount, 0);
            assert.equal(overAmount.line_total, 0);

            const overPercent = calculate({ qty: 1, rate: 100, discount_type: "PERCENT", discount_value: 150 });
            assert.equal(overPercent.discount_amount, 100);
            assert.equal(overPercent.taxable_amount, 0);
        });

        test("GST components are each charged on the post-discount taxable amount", () => {
            const line = calculate({
                qty: 2,
                rate: 100,
                discount_type: "PERCENT",
                discount_value: 10,
                cgst_percent: 9,
                sgst_percent: 9
            });

            assert.equal(line.taxable_amount, 180);
            assert.equal(line.cgst_amount, 16.2);
            assert.equal(line.sgst_amount, 16.2);
            assert.equal(line.igst_amount, 0);
            assert.equal(line.line_total, 212.4);
        });

        test("IGST is an alternative to CGST+SGST, not an addition", () => {
            const intraState = calculate({ qty: 1, rate: 1000, cgst_percent: 9, sgst_percent: 9 });
            const interState = calculate({ qty: 1, rate: 1000, igst_percent: 18 });

            assert.equal(intraState.line_total, 1180);
            assert.equal(interState.line_total, 1180);
        });

        test("tax_percent is the sum of the three GST rates", () => {
            assert.equal(calculate({ qty: 1, rate: 100, cgst_percent: 9, sgst_percent: 9 }).tax_percent, 18);
            assert.equal(calculate({ qty: 1, rate: 100, igst_percent: 18 }).tax_percent, 18);
            assert.equal(calculate({ qty: 1, rate: 100 }).tax_percent, 0);
        });

        test("every stored amount is rounded to 2 decimal places", () => {
            const line = calculate({ qty: 3, rate: 11.111, cgst_percent: 9, sgst_percent: 9 });

            ["gross_amount", "discount_amount", "taxable_amount", "cgst_amount", "sgst_amount", "igst_amount", "line_total"]
                .forEach((field) => {
                    assert.equal(line[field], Number(line[field].toFixed(2)), `${field} = ${line[field]}`);
                });
        });

        test("mutates the item in place and returns it", () => {
            const item = { qty: 1, rate: 10 };
            const returned = calculate(item);

            assert.equal(returned, item);
            assert.equal(item.line_total, 10);
        });
    });
});

// Where the two copies disagree. Both are live in production; a change to one
// silently diverges the two documents unless a test says so.
describe("calculateLineAmounts - the two copies have drifted", () => {
    test("only the quotation copy back-computes discount_percent", () => {
        const quotationLine = quotationPage.calculateLineAmounts({
            qty: 2,
            rate: 100,
            discount_type: "AMOUNT",
            discount_value: 50
        });
        const salesOrderLine = salesOrderPage.calculateLineAmounts({
            qty: 2,
            rate: 100,
            discount_type: "AMOUNT",
            discount_value: 50
        });

        assert.equal(quotationLine.discount_percent, 25);
        assert.equal(salesOrderLine.discount_percent, undefined);
    });

    test("the quotation copy zeroes discount_percent when there is no discount type", () => {
        assert.equal(quotationPage.calculateLineAmounts({ qty: 1, rate: 100, discount_percent: 99 }).discount_percent, 0);
    });

    test("the quotation copy guards discount_percent against a zero gross", () => {
        const line = quotationPage.calculateLineAmounts({
            qty: 0,
            rate: 0,
            discount_type: "AMOUNT",
            discount_value: 50
        });

        assert.equal(line.discount_percent, 0, "must not divide by a zero gross");
        assert.ok(!Number.isNaN(line.discount_percent));
    });

    test("only the sales order copy stores tax_amount, which sales_order_items has a column for", () => {
        const quotationLine = quotationPage.calculateLineAmounts({ qty: 1, rate: 100, cgst_percent: 9, sgst_percent: 9 });
        const salesOrderLine = salesOrderPage.calculateLineAmounts({ qty: 1, rate: 100, cgst_percent: 9, sgst_percent: 9 });

        assert.equal(salesOrderLine.tax_amount, 18);
        assert.equal(quotationLine.tax_amount, undefined);
    });
});

// Known rounding warts. These assert what the code does today so that a
// deliberate fix shows up as a failing test rather than a silent change to
// everyone's totals.
describe("calculateLineAmounts - rounding behaviour (documented, not endorsed)", () => {
    test("line_total rounds the sum, so stored components need not add up to it", () => {
        // taxable 2.50 at 5% + 5% gives two 0.125 components. Each is stored
        // rounded up to 0.13, but line_total rounds 2.50 + 0.25 = 2.75.
        const line = PAGES[0].calculate({ qty: 1, rate: 2.5, cgst_percent: 5, sgst_percent: 5 });

        assert.equal(line.cgst_amount, 0.13);
        assert.equal(line.sgst_amount, 0.13);
        assert.equal(line.line_total, 2.75);
        assert.notEqual(line.line_total, line.taxable_amount + line.cgst_amount + line.sgst_amount);
    });

    test("roundMoney is binary-float half-up, so some half-cents round down", () => {
        // TODO: 1.005 is not representable in binary floating point (it is
        // 1.00499...), so Math.round(value * 100) takes it down to 1.00.
        // Decimal-safe rounding would give 1.01.
        assert.equal(quotationPage.roundMoney(1.005), 1);
        assert.equal(quotationPage.roundMoney(2.675), 2.68);
        assert.equal(quotationPage.roundMoney(10.555), 10.56);
    });
});
