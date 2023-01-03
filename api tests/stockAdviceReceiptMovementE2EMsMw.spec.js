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
const stockAdvice = require(`../../fixtures/intMailShip/intStockAdvice-${Cypress.env('version')}.json`);
const locationBoxVariables = require('../../fixtures/intMailWise/intLocationBox.json');
const locationPickingVariables = require('../../fixtures/intMailWise/intLocationPicking.json');

let mwHeaders = null;
let msHeaders = null;

describe('Stock advice-receipt-movement synchronization MailShip-MailWise E2E test', () => { //[MW-1319, MW-1390, MW-1706]

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
    let externalId = null;
    let receiptId = null;
    let receiptNumber = null;
    let advanceShipNoticeItemId = null;
    let number = null;
    let productId = null;
    let locationIdFrom = null;
    let locationIdTo = null;

    const modifyStockAdvice = () => ({
        ...stockAdvice,
        internalId: `${prefix}${cy.faker.finance.account()}`,
        countOfUnits: cy.faker.random.number(max) + 1,
        expectedAt: moment().add(30, 'days').format('YYYY-MM-DD')
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

    const buildInboundReceipt = (receiptNumber) => {
        const inboundReceipt = {
            criteria:
            {
                wmsInternalId:
                {
                    eq: receiptNumber
                }
            }
        }
        return inboundReceipt;
    }

    it('Should create a stock advice in MailShip', () => {
        const stockAdvice = modifyStockAdvice();
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
            stockAdviceToCheck.countOfUnits = result.countOfUnits;
            stockAdviceToCheck.packagingUnit = result.packagingUnit;
            stockAdviceToCheck.expectedAt = result.expectedAt;
        });
    });

    it('Should update a stock advice in MailShip', () => {
        const stockAdviceToUpdate = modifyStockAdvice();
        cy.request({
            url: `${urlMailShip}${Endpoints.MAILSHIP_STOCK_ADVICE}/${stockAdviceToCheck.id}`,
            method: 'PUT',
            headers: msHeaders,
            body: stockAdviceToUpdate
        }).then((response) => {
            expect(response).to.have.property('status', 200);
            const result = response.body;
            expect(result).not.be.empty;
            expect(result).to.have.all.keys(PropertiesMS.stockAdvice);
            expect(result.id).to.eq(stockAdviceToCheck.id);
            expect(result.countOfUnits).to.eq(stockAdviceToUpdate.countOfUnits);
            expect(result.internalId).to.eq(stockAdviceToUpdate.internalId);
            stockAdviceToCheck.id = result.id;
            stockAdviceToCheck.internalId = result.internalId;
            stockAdviceToCheck.status = result.status;
            stockAdviceToCheck.countOfItems = result.countOfItems;
            stockAdviceToCheck.countOfUnits = result.countOfUnits;
            stockAdviceToCheck.sumOfQuantity = result.sumOfQuantity;
            stockAdviceToCheck.packagingUnit = result.packagingUnit;
        });
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

    it('Should return a stockAdvice in MailWise updated in Mailship', () => {
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
            advanceShipNoticeId = node.id;
            externalId = node.externalId;
        });
    });

    it('Should return an advanceShipNoticeItems in MailWise', () => {
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
            const dataItem = response.body.data.advanceShipNoticeItems;
            const result = dataItem.edges[0];
            const product = result.node.product;
            expect(dataItem).to.have.all.keys('pageInfo', 'totalCount', 'edges');
            expect(result).to.have.all.keys('cursor', 'node');
            expect(result.node).to.have.all.keys(PropertiesMW.advanceShipNoticeItems);
            expect(product).to.have.all.keys(PropertiesMW.advanceShipNoticeItemsProduct);
            expect(product.organisation).to.have.key('productMeasuresMandatory');
            cy.log(`status = ${response.status} with advanceShipNoticeItemId = ${result.node.id} and number = ${result.node.number}`);
            advanceShipNoticeItemId = result.node.id;
            number = result.node.number;
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
            number
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
        });
    });

    it('Should return the receipt in status ready in MailWise', () => {
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
            expect(result.status).to.eq('READY');
        });
    });

    it('Should return the movement in status receive in MailWise', () => {
        const variables = {
            filter: [
                {
                    advanceShipNoticeExternalId: {
                        eq: externalId
                    }
                }
            ]
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: queries.movements, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const movement = response.body.data.movements;
            expect(movement).to.have.all.keys('pageInfo', 'totalCount', 'edges');
            expect(movement.edges.length).to.eq(1);
            expect(movement.edges[0]).to.have.all.keys('cursor', 'node');
            const result = movement.edges[0].node;
            expect(result).to.have.all.keys(PropertiesMW.movements);
            expect(result.organisationStore).to.have.all.keys('name', 'organisation');
            expect(result.type).to.eq('RECEIVE');
            expect(result.number).to.eq(number);
            const product = result.product;
            expect(product).to.have.all.keys(PropertiesMW.productMovement);
            expect(product.id).to.eq(productId);
            const receipt = result.receiptItem.receipt;
            expect(receipt).to.have.all.keys(PropertiesMW.receiptMovement);
            expect(receipt.id).to.eq(receiptId);
            expect(receipt.receiptNumber).to.eq(receiptNumber);
            expect(receipt.type).to.eq('SUPPLY');
            expect(receipt.advanceShipNotice).to.have.key('externalId');
            expect(receipt.advanceShipNotice.externalId).to.eq(externalId);
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
    it('Should return the movement in status relocation in MailWise', () => {
        const variables = {
            filter: [
                {
                    advanceShipNoticeExternalId: {
                        eq: externalId
                    }
                }
            ],
            sort: [
                {
                    field: 'movedAt',
                    order: 'DESC'
                }
            ]
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: queries.movements, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const movement = response.body.data.movements;
            expect(movement).to.have.all.keys('pageInfo', 'totalCount', 'edges');
            expect(movement.edges.length).to.eq(2);
            expect(movement.edges[0]).to.have.all.keys('cursor', 'node');
            const result = movement.edges[0].node;
            expect(result).to.have.all.keys(PropertiesMW.movements);
            expect(result.organisationStore).to.have.all.keys('name', 'organisation');
            expect(result.type).to.eq('RELOCATION');
            expect(result.number).to.eq(number);
            const product = result.product;
            expect(product).to.have.all.keys(PropertiesMW.productMovement);
            expect(product.id).to.eq(productId);
            const receipt = result.receiptItem.receipt;
            expect(receipt).to.have.all.keys(PropertiesMW.receiptMovement);
            expect(receipt.id).to.eq(receiptId);
            expect(receipt.receiptNumber).to.eq(receiptNumber);
            expect(receipt.type).to.eq('SUPPLY');
            expect(receipt.advanceShipNotice).to.have.key('externalId');
            expect(receipt.advanceShipNotice.externalId).to.eq(externalId);
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

    it('Should return an inbound receipt in MailShip finished in MailWise', {
        retries
    }, () => {
        cy.wait(10000);
        const inboundReceipt = buildInboundReceipt(receiptNumber);
        cy.request({
            url: `${urlMailShip}${Endpoints.MAILSHIP_INBOUND_RECEIPT_LIST}`,
            method: 'POST',
            headers: msHeaders,
            body: inboundReceipt
        }).then((response) => {
            expect(response).to.have.property('status', 200);
            const result = response.body;
            expect(result).not.be.empty;
            expect(result.results.length).to.eq(1);
            const receipt = result.results[0];
            expect(receipt).to.have.all.keys(PropertiesMS.inboundReceipts);
            cy.log(`MailShip inboundReceiptId = ${receipt.id} and receiptNumber = ${receipt.wmsInternalId}`);
        });
    });

    it('Should return a stock movement in MailShip', {
        retries
    }, () => {
        cy.wait(5000);
        cy.request({
            url: `${urlMailShip}${Endpoints.MAILSHIP_STOCK_MOVEMENT_LIST}`,
            method: 'POST',
            headers: msHeaders,
            body: {
                criteria: {
                    'inboundReceipt.stockAdvice.internalId': {
                        eq: externalId
                    }
                }
            }
        }).then((response) => {
            expect(response).to.have.property('status', 200);
            expect(response.body).not.be.empty;
            const stockMovement = response.body.results[0];
            expect(stockMovement).to.have.all.keys(PropertiesMS.stockMovements);
            expect(stockMovement.movementType).to.eq('in');
            expect(stockMovement.movementSubType).to.eq('new');
            expect(stockMovement.quantity).to.eq(number);
        });
    });

    it('Should return a stock advice in status finished in MailShip', {
        retries
    }, () => {
        cy.wait(5000);
        cy.request({
            url: `${urlMailShip}${Endpoints.MAILSHIP_STOCK_ADVICE}/${stockAdviceToCheck.id}`,
            method: 'GET',
            headers: msHeaders,
        }).then((response) => {
            expect(response).to.have.property('status', 200);
            const result = response.body;
            expect(result.id).to.eq(stockAdviceToCheck.id);
            expect(result.status).to.eq('finished');
        });
    });
});