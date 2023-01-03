import moment from 'moment';
import { PropertiesMW } from '../../support/constants/propertiesMailWise';
const urlMailWise = Cypress.config('urlMailWise');
const userMailWise = Cypress.config('userMailWise');
const queries = require('../../fixtures/mailwise/queries.json');
const mutations = require('../../fixtures/mailwise/mutations.json');

let headers = null;
let tokenMailWise = null;

describe('Stock advice test', () => { // [MW-1241]
    before(() => {
        cy.loginMailWise(userMailWise.login, userMailWise.password);
        cy.get('@response').then(response => {
            headers = {
                authorization: `Bearer ${response.body.data.login.token}`
            };
            tokenMailWise = response.body.data.login.token;
            cy.log(`MailWise login status = ${response.status} with token = ${tokenMailWise}`);
        });
    });

    let advanceShipNoticeId = null;
    let organisationId = null;
    let organisationStoreId = null;
    let supplierId = null;
    let externalId = null;
    let productId = null;
    let productSku = null;
    let internalSku = null;

    it('Should return an advanceShipNotices in MailWise', () => {
        const variables = {
            first: 10,
            filter: [
                {
                    status: {
                        in: [
                            'WAITING'
                        ]
                    }
                }
            ]
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers,
            body: { query: queries.advanceShipNotices, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const dataItem = response.body.data.advanceShipNotices;
            const result = dataItem.edges[0];
            expect(dataItem).to.have.all.keys('pageInfo', 'totalCount', 'edges');
            expect(result).to.have.all.keys('cursor', 'node');
            expect(result.node).to.have.all.keys(PropertiesMW.advanceShipNotice);
            expect(result.node.items[0]).to.have.all.keys('product', 'number', 'numberSupplied');
            expect(result.node.items[0].product).to.have.key('codes');
            cy.log(`status = ${response.status} with advanceShipNoticeId = ${result.node.id}`);
            advanceShipNoticeId = result.node.id;
            organisationId = result.node.organisation.id;
            organisationStoreId = result.node.organisationStore.id;
            supplierId = result.node.supplier.id;
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
            headers,
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
            cy.log(`status = ${response.status} with advanceShipNoticeItemId = ${result.node.id}`);
            productId = product.id;
            productSku = product.productSku;
            internalSku = product.internalSku;
        });
    });

    it('Should create a advanceShipNotice in MailWise', () => {
        const variables = {
            input: {
                customerId: null,
                expectedAt: moment().format('YYYY-MM-DD'),
                externalId: externalId,
                items: [{
                    number: 20,
                    productId: productId,
                    productSku: productSku,
                    internalSku: internalSku
                }],
                onHold: false,
                organisationId: organisationId,
                organisationStoreId: organisationStoreId,
                packagingUnit: 'PACKAGE',
                packagingUnitCount: 5,
                supplierId: supplierId
            }
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers,
            body: { query: mutations.advanceShipNoticeCreate, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const dataItem = response.body.data.advanceShipNoticeCreate;
            const result = dataItem.advanceShipNotice;
            expect(dataItem).to.have.key('advanceShipNotice');
            expect(result).to.have.all.keys(PropertiesMW.advanceShipNoticeCreate);
            expect(result.items[0]).to.have.all.keys('number', 'numberSupplied', 'product');
            expect(result.items[0].product).to.have.all.keys('id', 'productSku', 'internalSku');
            expect(result.expectedAt).to.eq(variables.input.expectedAt);
            expect(result.externalId).to.eq(variables.input.externalId);
            expect(result.packagingUnit).to.eq(variables.input.packagingUnit);
            expect(result.packagingUnitCount).to.eq(variables.input.packagingUnitCount);
            externalId = result.externalId;
        });
    });

    it('Should update a advanceShipNotice in MailWise', () => {
        const variables = {
            input: {
                id: advanceShipNoticeId,
                customerId: null,
                expectedAt: moment().format('YYYY-MM-DD'),
                externalId: cy.faker.random.uuid(),
                items: [{
                    number: 10,
                    productId: productId,
                    productSku: productSku,
                    internalSku: internalSku
                }],
                organisationStoreId: organisationStoreId,
                packagingUnit: 'PALLET',
                packagingUnitCount: 1,
                supplierId: supplierId
            }
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers,
            body: { query: mutations.advanceShipNoticeUpdate, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const dataItem = response.body.data.advanceShipNoticeUpdate;
            const result = dataItem.advanceShipNotice;
            expect(dataItem).to.have.key('advanceShipNotice');
            expect(result).to.have.all.keys(PropertiesMW.advanceShipNoticeUpdate);
            expect(result.items[0]).to.have.all.keys('number', 'numberSupplied', 'product', 'ref1', 'ref2', 'ref3');
            expect(result.items[0].product).to.have.key('id');
            expect(result.id).to.eq(variables.input.id);
            expect(result.expectedAt).to.eq(variables.input.expectedAt);
            expect(result.externalId).to.eq(variables.input.externalId);
            expect(result.items[0].number).to.eq(variables.input.items[0].number);
        });
    });

    it('Should update a advice note in MailWise', () => {
        const variables = {
            id: advanceShipNoticeId,
            internalNote: 'Update internal note'
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers,
            body: { query: mutations.adviceNoteUpdate, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const dataItem = response.body.data.advanceShipNoticeUpdateInternalNote;
            const result = dataItem.advanceShipNotice;
            expect(dataItem).to.have.key('advanceShipNotice');
            expect(result).to.have.all.keys(PropertiesMW.advanceShipNoticeUpdateInternalNote);
            expect(result.id).to.eq(advanceShipNoticeId);
            expect(result.internalNote).to.eq(variables.internalNote);
        });
    });

    it('Should block a advanceShipNotice in MailWise', () => {
        const variables = {
            id: advanceShipNoticeId
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers,
            body: { query: mutations.advanceShipNoticeBlock, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const dataItem = response.body.data.advanceShipNoticeBlock;
            const result = dataItem.advanceShipNotice;
            expect(dataItem).to.have.key('advanceShipNotice');
            expect(result).to.have.all.keys('id', 'status', 'blocked', 'blockedBy', '__typename');
            expect(result.blockedBy).to.have.key('id');
            expect(result.id).to.eq(variables.id);
            expect(result.blocked).to.eq(true);
        });
    });

    it('Should unblock a advanceShipNotice in MailWise', () => {
        const variables = {
            id: advanceShipNoticeId
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers,
            body: { query: mutations.advanceShipNoticeUnblock, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const dataItem = response.body.data.advanceShipNoticeUnblock;
            const result = dataItem.advanceShipNotice;
            expect(dataItem).to.have.key('advanceShipNotice');
            expect(result.id).to.eq(variables.id);
            expect(result.blocked).to.eq(false);
        });
    });
});