import { PropertiesMW } from '../../support/constants/propertiesMailWise';
import { PropertiesMS } from '../../support/constants/propertiesMailShip';
import { Endpoints } from '../../support/constants/endpoints';
import moment from 'moment';
const urlMailShip = Cypress.config('urlMailShip');
const userMailShip = Cypress.config('adminMailShip');
const urlMailWise = Cypress.config('urlMailWise');
const userMailWise = Cypress.config('userMailWise');
const queries = require('../../fixtures/mailwise/queries.json');
const intOrganisation = require(`../../fixtures/intMailShip/intOrganisation-${Cypress.env('version')}.json`);
const stockAdvice = require(`../../fixtures/intMailShip/intStockAdvice-${Cypress.env('version')}.json`);


let mwHeaders = null;
let msHeaders = null;

describe('Stock advice status synchronization MailShip-MailWise test', () => { //[MW-1582]

    before(() => {
        cy.loginMailShip(userMailShip.login, userMailShip.password);
        cy.get('@response').then(response => {
            const token = response.body.token;
            msHeaders = {
                authorization: `Bearer ${token}`
            }
            cy.log(`MailShip login status = ${response.status} with token = ${token}`);
        });
        cy.loginMailWise(userMailWise.login, userMailWise.password);
        cy.get('@response').then(response => {
            const token = response.body.data.login.token;
            mwHeaders = {
                authorization: `Bearer ${token}`
            };
            cy.log(`MailWise login status = ${response.status} with token = ${token}`);
        });
    });

    const prefix = 'Cy';
    const max = 10;
    const iteration = 2;
    const ids = [];
    const retries = {
        runMode: 2,
        openMode: 2
    };
    const stockAdviceToCheck = {
        id: null,
        internalId: null,
        status: null,
        packagingUnit: null,
        countOfUnits: 0,
        countOfItems: 0,
        sumOfQuantity: 0,
        expectedAt: null
    };

    const createStockAdvice = () => ({
        ...stockAdvice,
        internalId: `${prefix}${cy.faker.finance.account()}`,
        countOfUnits: cy.faker.random.number(max) + 1,
        expectedAt: moment().add(30, 'days').format('YYYY-MM-DD'),
        items: []
    });

    const buildStockAdviceVariables = (internalId) => {
        const variables = {
            filter: [
                {
                    externalId: {
                        eq: internalId
                    }
                }
            ]
        }
        return variables;
    }

    it('Should return a products for stock advice in MailShip', () => {
        cy.request({
            url: `${urlMailShip}${Endpoints.MAILSHIP_PRODUCT_LIST}`,
            method: 'POST',
            headers: msHeaders,
            body: {
                criteria:
                {
                    active:
                    {
                        flag: true
                    },
                    organisation:
                    {
                        eq: intOrganisation.id
                    }
                },
                limit: 10
            }
        }).then((response) => {
            expect(response).to.have.property('status', 200);
            expect(response.body).not.be.empty;
            expect(response.body.results.length).to.be.greaterThan(0);
            for (let i = 0; i < iteration; i++) {
                ids.push(response.body.results[i].id);
                cy.log(`status = ${response.status} with id = ${response.body.results[i].id} & iteration = ${i}`);
            }
        });
    });

    it('Should create a stock advice in MailShip', () => {
        const stockAdvice = createStockAdvice();
        if (ids.length == iteration) {
            for (let j = 0; j < ids.length; j++) {
                cy.log(`id = ${ids[j]}`);
                stockAdvice.items.push({
                    product: ids[j],
                    quantity: 15,
                    ref1: 'ref1',
                    ref2: 'ref2',
                    ref3: 'ref3'
                });
            };
            cy.request({
                url: urlMailShip + Endpoints.MAILSHIP_STOCK_ADVICE,
                method: 'POST',
                headers: msHeaders,
                body: stockAdvice
            }).then((response) => {
                expect(response).to.have.property('status', 201);
                const result = response.body;
                expect(result).not.be.empty;
                expect(result).to.have.all.keys(PropertiesMS.stockAdvice);
                cy.log(`MailShip stock advice status = ${response.status} with internalId = ${result.internalId} and stockAdviceStatus = ${result.status}`);
                stockAdviceToCheck.id = result.id;
                stockAdviceToCheck.internalId = result.internalId;
                stockAdviceToCheck.status = result.status;
                stockAdviceToCheck.countOfItems = result.countOfItems;
                stockAdviceToCheck.countOfUnits = result.countOfUnits;
                stockAdviceToCheck.packagingUnit = result.packagingUnit;
                stockAdviceToCheck.sumOfQuantity = result.sumOfQuantity;
                stockAdviceToCheck.expectedAt = result.expectedAt;
            });
        };
    });

    it('Should update a stock advice status to waiting in MailShip', () => {
        cy.request({
            url: `${urlMailShip}${Endpoints.MAILSHIP_STOCK_ADVICE_STATUS}/${stockAdviceToCheck.id}/new`,
            method: 'PUT',
            headers: msHeaders
        }).then((response) => {
            expect(response).to.have.property('status', 200);
            const result = response.body;
            expect(result).not.be.empty;
            expect(result.status).to.eq('waiting');
            stockAdviceToCheck.status = result.status;
        });
    });

    it('Should return a stock advice in status waiting in MailWise', () => {
        cy.wait(5000);
        const variables = buildStockAdviceVariables(stockAdviceToCheck.internalId);
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: queries.advanceShipNotices, variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const advanceShipNotice = response.body.data.advanceShipNotices;
            expect(advanceShipNotice.edges.length).to.eq(1);
            const node = advanceShipNotice.edges[0].node;
            expect(node).to.have.all.keys(PropertiesMW.advanceShipNotice);
            expect(node.externalId).to.eq(stockAdviceToCheck.internalId);
            expect(node.status.toLowerCase()).to.eq('waiting');
            expect(node.packagingUnit.toLowerCase()).to.eq(stockAdviceToCheck.packagingUnit);
            expect(node.packagingUnitCount).to.eq(stockAdviceToCheck.countOfUnits);
            expect(stockAdviceToCheck.expectedAt).to.includes(node.expectedAt);
            cy.log(`advanceShipNoticeId = ${node.id} with externalId = ${node.externalId} and readableId = ${node.readableId}`);
        });
    });

    it('Should cancel a stock advice in MailShip', () => {
        cy.request({
            url: `${urlMailShip}${Endpoints.MAILSHIP_STOCK_ADVICE}/cancel`,
            method: 'PUT',
            headers: msHeaders,
            body: {
                stockAdvices: [
                    stockAdviceToCheck.id
                ]
            }
        }).then((response) => {
            expect(response).to.have.property('status', 204);
        });
    });

    it('Should not found a stock advice in MailShip', {
        retries
    }, () => {
        cy.request({
            url: `${urlMailShip}${Endpoints.MAILSHIP_STOCK_ADVICE}/${stockAdviceToCheck.id}`,
            method: 'GET',
            headers: msHeaders,
            failOnStatusCode: false,
        }).then((response) => {
            expect(response).to.have.property('status', 404);
        });
    });

    it('Should not found a stock advice in MailWise', () => {
        cy.wait(5000);
        const variables = buildStockAdviceVariables(stockAdviceToCheck.internalId);
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: queries.advanceShipNotices, variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const advanceShipNotice = response.body.data.advanceShipNotices;
            expect(advanceShipNotice.edges.length).to.eq(0);
        });
    });
});