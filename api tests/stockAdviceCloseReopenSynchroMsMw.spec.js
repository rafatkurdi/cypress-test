import { PropertiesMW } from '../../support/constants/propertiesMailWise';
import { PropertiesMS } from '../../support/constants/propertiesMailShip';
import { Endpoints } from '../../support/constants/endpoints';
import moment from 'moment';
const urlMailShip = Cypress.config('urlMailShip');
const userMailShip = Cypress.config('adminMailShip');
const urlMailWise = Cypress.config('urlMailWise');
const userMailWise = Cypress.config('userMailWise');
const queries = require('../../fixtures/mailwise/queries.json');
const mutations = require('../../fixtures/mailwise/mutations.json');
const intOrganisation = require(`../../fixtures/intMailShip/intOrganisation-${Cypress.env('version')}.json`);
const stockAdvice = require(`../../fixtures/intMailShip/intStockAdvice-${Cypress.env('version')}.json`);
const locationBoxVariables = require('../../fixtures/intMailWise/intLocationBox.json');
const locationPickingVariables = require('../../fixtures/intMailWise/intLocationPicking.json');

let mwHeaders = null;
let msHeaders = null;

describe('Close and reopen stock advice synchronization MailShip-MailWise test', () => { //[MW-1391]

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
    let advanceShipNoticeId = null;
    let receiptId = null;
    let receiptNumber = null;
    let advanceShipNoticeItemId = null;
    let number = null;
    let productId = null;
    let locationIdFrom = null;
    let locationIdTo = null;
    let responseAdvanceShipNotice = null;

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
                sort: 
                [
                    { 
                        field: 'createdAt',
                        order: 'desc' 
                    }
                ],
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

    it('Should update a stock advice status in MailShip', () => {
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

    it('Should return a stock advice in MailWise created in Mailship', () => {
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
            expect(node.status.toLowerCase()).to.eq(stockAdviceToCheck.status);
            expect(node.itemCount).to.eq(stockAdviceToCheck.countOfItems);
            expect(node.packagingUnit.toLowerCase()).to.eq(stockAdviceToCheck.packagingUnit);
            expect(node.packagingUnitCount).to.eq(stockAdviceToCheck.countOfUnits);
            expect(node.total).to.eq(stockAdviceToCheck.sumOfQuantity);
            expect(stockAdviceToCheck.expectedAt).to.includes(node.expectedAt);
            cy.log(`advanceShipNoticeId = ${node.id} with externalId = ${node.externalId} and readableId = ${node.readableId}`);
            responseAdvanceShipNotice = node;
            advanceShipNoticeId = node.id;
        });
    });

    it('Should return a stock advice items in MailWise', () => {
        const variables = {
            filter: [
                {
                    advanceShipNoticeId: {
                        eq: advanceShipNoticeId
                    }
                }
            ]
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: queries.advanceShipNoticeItems, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const node = response.body.data.advanceShipNoticeItems.edges[0].node;
            const product = node.product;
            expect(node).to.have.all.keys(PropertiesMW.advanceShipNoticeItems);
            expect(product).to.have.all.keys(PropertiesMW.advanceShipNoticeItemsProduct);
            cy.log(`status = ${response.status} with advanceShipNoticeItemId = ${node.id} and number = ${node.number}`);
            advanceShipNoticeItemId = node.id;
            number = node.number;
            productId = product.id;
        });
    });

    it('Should create a receipt in MailWise', () => {
        const variables = {
            input: {
                advanceShipNoticeId,
                note: 'note'
            }
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: mutations.receiptCreate, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const receipt = response.body.data.receiptCreate;
            const result = receipt.receipt;
            expect(receipt).to.have.key('receipt');
            expect(result).to.have.all.keys(PropertiesMW.receiptCreate);
            expect(result.advanceShipNotice).to.have.key('id');
            expect(result.createdBy).to.have.key('id');
            expect(result.organisationStore).to.have.key('id');
            expect(result.advanceShipNotice.id).to.eq(variables.input.advanceShipNoticeId);
            expect(result.status).to.eq('DRAFT');
            cy.log(`status = ${result.status} with receiptNumber = ${result.receiptNumber} and receiptId = ${result.id}`);
            receiptId = result.id;
            receiptNumber = result.receiptNumber;
        });
    });

    it('Should return a location with type BOX in MailWise', () => {
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: queries.locations, variables: locationBoxVariables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const locations = response.body.data.locations;
            const result = locations.edges[0].node;
            expect(result).to.have.all.keys(PropertiesMW.locations);
            locationIdFrom = result.id;
        });
    });

    it('Should create an inbound in MailWise', () => {
        const variables = {
            receiptId,
            locationId: locationIdFrom,
            advanceShipNoticeItemId,
            number: number
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: mutations.receiptAddItemLocationDraft, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const inbount = response.body.data.receiptAddItemLocationDraft;
            const result = inbount.receiptItemLocationDraft;
            expect(result).to.have.all.keys(PropertiesMW.receiptItemLocationDraft);
            expect(result.number).to.eq(variables.number);
            number = result.number;
        });
    });

    it('Should mark the receipt as make ready in MailWise', () => {
        const variables = {
            id: receiptId,
            redirectTo: '/inbound'
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: mutations.receiptMakeReady, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const receipt = response.body.data.receiptMakeReady;
            const result = receipt.receipt;
            expect(receipt).to.have.all.keys(PropertiesMW.receiptMakeReady);
            expect(result.id).to.eq(variables.id);
            receiptId = receipt.id;
        });
    });

    it('Should return a location with type PICKING in MailWise', () => {
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: queries.locations, variables: locationPickingVariables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const locations = response.body.data.locations;
            const result = locations.edges[1].node;
            expect(result).to.have.all.keys(PropertiesMW.locations);
            locationIdTo = result.id;
        });
    });

    it('Should realocation the product in MailWise', () => {
        const variables = {
            clientMutationId: cy.faker.random.uuid(),
            number,
            locationIdFrom,
            productId,
            locationIdTo
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: mutations.moveProduct, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const result = response.body.data.moveProduct;
            expect(result).to.have.key('clientMutationId');
            expect(result.clientMutationId).to.eq(variables.clientMutationId);
        });
    });

    it('Should return the receipt in status finished in MailWise', {
        retries
    }, () => {
        const variables = {
            filter: [
                {
                    type: {
                        eq: 'SUPPLY'
                    },
                    receiptNumber: {
                        eq: receiptNumber
                    }
                }
            ]
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: queries.receipts, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const dataItem = response.body.data.receipts;
            const result = dataItem.edges[0].node;
            expect(dataItem).to.have.all.keys('pageInfo', 'totalCount', 'edges');
            expect(dataItem.edges[0]).to.have.all.keys('cursor', 'node');
            expect(result).to.have.all.keys(PropertiesMW.receipts);
            expect(result.organisationStore).to.have.all.keys('name', 'organisation');
            expect(result.organisationStore.organisation).to.have.key('name');
            expect(result.status).to.eq('FINISHED');
        });
    });

    it('Should return a stock advice in status partially finished in MailWise', () => {
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
            expect(node.status.toLowerCase()).to.eq('partially_finished');
            expect(node.totalSupplied).to.eq(number);
            expect(node.itemCount).to.eq(stockAdviceToCheck.countOfItems);
            expect(node.packagingUnit.toLowerCase()).to.eq(stockAdviceToCheck.packagingUnit);
            expect(node.packagingUnitCount).to.eq(stockAdviceToCheck.countOfUnits);
            expect(node.total).to.eq(stockAdviceToCheck.sumOfQuantity);
            expect(stockAdviceToCheck.expectedAt).to.includes(node.expectedAt);
            cy.log(`advanceShipNoticeId = ${node.id} with externalId = ${node.externalId} and readableId = ${node.readableId}`);
            responseAdvanceShipNotice = node;
            advanceShipNoticeId = node.id;
        });
    });
    it('Should return a stock advice in status partially finished in MailShip', {
        retries
    }, () => {
        cy.wait(15000);
        cy.request({
            url: `${urlMailShip}${Endpoints.MAILSHIP_STOCK_ADVICE}/${stockAdviceToCheck.id}`,
            method: 'GET',
            headers: msHeaders
        }).then((response) => {
            expect(response).to.have.property('status', 200);
            const result = response.body;
            expect(result).to.have.all.keys(PropertiesMS.stockAdvice);
            expect(result.id).to.eq(stockAdviceToCheck.id);
            expect(result.status).to.eq('partially_finished');
            expect(result.sumOfSuppliedQuantity).to.eq(responseAdvanceShipNotice.totalSupplied);
            expect(result.internalId).to.eq(responseAdvanceShipNotice.externalId);
            expect(result.countOfItems).to.eq(responseAdvanceShipNotice.itemCount);
            expect(result.packagingUnit).to.eq(responseAdvanceShipNotice.packagingUnit.toLowerCase());
            expect(result.countOfUnits).to.eq(responseAdvanceShipNotice.packagingUnitCount);
            expect(result.sumOfQuantity).to.eq(responseAdvanceShipNotice.total);
            expect(result.expectedAt).to.includes(responseAdvanceShipNotice.expectedAt);
        });
    });

    it('Should close a stock advice in MailShip', () => {
        cy.request({
            url: `${urlMailShip}${Endpoints.MAILSHIP_STOCK_ADVICE}/close/${stockAdviceToCheck.id}`,
            method: 'PUT',
            headers: msHeaders
        }).then((response) => {
            expect(response).to.have.property('status', 200);
            const result = response.body;
            expect(result.id).to.eq(stockAdviceToCheck.id);
            expect(result.status).to.eq('closed');
        });
    });

    it('Should return a stock advice in status closed in MailWise', () => {
        cy.wait(10000);
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
            expect(node.status.toLowerCase()).to.eq('closed');
            expect(node.packagingUnit.toLowerCase()).to.eq(stockAdviceToCheck.packagingUnit);
            expect(node.packagingUnitCount).to.eq(stockAdviceToCheck.countOfUnits);
            expect(stockAdviceToCheck.expectedAt).to.includes(node.expectedAt);
            cy.log(`advanceShipNoticeId = ${node.id} with externalId = ${node.externalId} and readableId = ${node.readableId}`);
            advanceShipNoticeId = node.id;
        });
    });

    it('Should open a stock advice in MailShip', () => {
        cy.request({
            url: `${urlMailShip}${Endpoints.MAILSHIP_STOCK_ADVICE}/open/${stockAdviceToCheck.id}`,
            method: 'PUT',
            headers: msHeaders
        }).then((response) => {
            expect(response).to.have.property('status', 200);
            const result = response.body;
            expect(result.id).to.eq(stockAdviceToCheck.id);
        });
    });

    it('Should return stock advice in status partially finished in MailShip', {
        retries
    }, () => {
        cy.wait(10000);
        cy.request({
            url: `${urlMailShip}${Endpoints.MAILSHIP_STOCK_ADVICE}/${stockAdviceToCheck.id}`,
            method: 'GET',
            headers: msHeaders
        }).then((response) => {
            expect(response).to.have.property('status', 200);
            const result = response.body;
            expect(result.id).to.eq(stockAdviceToCheck.id);
            expect(result.status).to.eq('partially_finished');
        });
    });

    it('Should return a stock advice in status partially finished in MailWise', () => {
        cy.wait(10000);
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
            expect(node.status.toLowerCase()).to.eq('partially_finished');
            expect(node.packagingUnit.toLowerCase()).to.eq(stockAdviceToCheck.packagingUnit);
            expect(node.packagingUnitCount).to.eq(stockAdviceToCheck.countOfUnits);
            expect(stockAdviceToCheck.expectedAt).to.includes(node.expectedAt);
            cy.log(`advanceShipNoticeId = ${node.id} with externalId = ${node.externalId} and readableId = ${node.readableId}`);
        });
    });
});