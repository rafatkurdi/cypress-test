import { PropertiesMW } from '../../support/constants/propertiesMailWise';
const urlMailWise = Cypress.config('urlMailWise');
const userMailWise = Cypress.config('userMailWise');
const queries = require('../../fixtures/mailwise/queries.json');
const mutations = require('../../fixtures/mailwise/mutations.json');

let headers = null;
let tokenMailWise = null;

describe('Receipts test', () => { // [MW-1242]
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

    let receiptId = null;
    let advanceShipNoticeId = null;

    it('Should return an advanceShipNotices in MailWise', () => {
        const variables = {
            first: 10,
            filter: [
                {
                    status: {
                        in: [
                            'WAITING',
                            'IN_PROGRESS',
                            'PARTIALLY_FINISHED' //avyza pro prijem -> stav WAITING, IN_PROGRESS a PARTIALLY_FINISHED
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
            cy.log(`status = ${response.status} with advanceShipNoticeId = ${dataItem.edges[0].node.id}`);
            advanceShipNoticeId = dataItem.edges[0].node.id;
        });
    });

    it('Should create a receipt in MailWise', () => {
        const variables = {
            input: {
                advanceShipNoticeId: advanceShipNoticeId,
                note: "note"
            }
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers,
            body: { query: mutations.receiptCreate, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const dataItem = response.body.data.receiptCreate;
            const result = dataItem.receipt;
            expect(dataItem).to.have.key('receipt');
            expect(result).to.have.all.keys(PropertiesMW.receiptCreate);
            expect(result.advanceShipNotice).to.have.key('id');
            expect(result.createdBy).to.have.key('id');
            expect(result.organisationStore).to.have.key('id');
            expect(result.advanceShipNotice.id).to.eq(variables.input.advanceShipNoticeId);
            expect(result.status).to.eq('DRAFT');
            receiptId = result.id;
        });
    });

    it('Should return a receipt created in MailWise', () => {
        const variables = {
            id: receiptId
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers,
            body: { query: queries.receipt, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const dataItem = response.body.data.receipt;
            const result = dataItem.advanceShipNotice.items[0];
            expect(dataItem).to.have.all.keys(PropertiesMW.receipt);
            expect(dataItem.organisationStore).to.have.all.keys('id', 'name');
            expect(dataItem.advanceShipNotice).to.have.all.keys(PropertiesMW.advanceShipNotice);
            expect(result).to.have.all.keys('id', 'product');
            expect(result.product).to.have.all.keys(PropertiesMW.advanceShipNoticeItemsProduct);
            expect(result.product.organisation).to.have.all.keys('id', 'name', 'productMeasuresMandatory');
            expect(dataItem.id).to.eq(variables.id);
            cy.log(`status = ${response.status} with receiptId = ${dataItem.id}`);
            receiptId = dataItem.id;
        });
    });

    it('Should update a receipt in MailWise', () => {
        const variables = {
            input: {
                id: receiptId,
                note: cy.faker.lorem.words()
            }
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers,
            body: { query: mutations.receiptUpdate, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const dataItem = response.body.data.receiptUpdate;
            const result = dataItem.receipt;
            expect(dataItem).to.have.key('receipt');
            expect(result).to.have.all.keys(PropertiesMW.receiptUpdate);
            expect(dataItem.receipt.id).to.eq(variables.input.id);
            expect(result.note).to.eq(variables.input.note);
            cy.log(`status = ${response.status} with receiptId = ${result.id}`);
        });
    });

    it('Should return a receipt updated in MailWise', () => {
        const variables = {
            first: 10,
            filter: [
                {
                    type: {
                        eq: "SUPPLY" //SUPPLY = nove prijmy, RETURN = vratky
                    }
                }
            ]
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers,
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
        });
    });
});