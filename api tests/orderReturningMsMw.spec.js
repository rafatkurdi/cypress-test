import { PropertiesMW } from '../../support/constants/propertiesMailWise';
import { Endpoints } from '../../support/constants/endpoints';
import { skipOn } from '@cypress/skip-test';

const urlMailShip = Cypress.config('urlMailShip');
const userMailShip = Cypress.config('adminMailShip');
const urlMailWise = Cypress.config('urlMailWise');
const userMailWise = Cypress.config('userMailWise');
const queries = require('../../fixtures/mailwise/queries.json');
const mutations = require('../../fixtures/mailwise/mutations.json');

let mwHeaders = null;
let msHeaders = null;

const isDev = () => {
    return Cypress.env('version') === 'dev';
}

describe('Order synchronization MailShip-MailWise test', () => { //[MW-1582]
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

    let customerId = null;
    let dispatchId = null;
    let dispatchStatus = null;

    const retries = {
        runMode: 2,
        openMode: 2
    };

    it('Should return a dispatch in MailWise', {
        retries
    }, () => {
        skipOn(isDev());
        const variables = {
            first: 10,
            filter: [
                {
                    status: {
                        in: [
                            "CARRIER_PICKED_UP",
                            "WAITING_FOR_THE_CARRIER"
                        ]
                    }
                }
            ],
            sort: [
                {
                    field: "createdAt",
                    order: "DESC"
                }
            ]

        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: queries.dispatches, variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const dispatch = response.body.data.dispatches.edges[0].node;
            expect(dispatch).to.have.all.keys(PropertiesMW.dispatch);
            dispatchId = dispatch.id;
            dispatchStatus = dispatch.status;
            const order = dispatch.order;
            expect(order).to.have.all.keys(PropertiesMW.order);
            customerId = order.customerId;
        });
    });

    it('Should change the dispatch status by the user in MailWise', {
        retries
    }, () => {
        skipOn(isDev());
        const variables = {
            id: dispatchId,
            status: 'RETURNING',
            clientMutationId: cy.faker.random.uuid()
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: mutations.dispatchStatusChangeByUser, variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const dispatchStatus = response.body.data.dispatchStatusChangeByUser;
            expect(dispatchStatus).to.have.key('clientMutationId');
            expect(dispatchStatus.clientMutationId).to.eq(variables.clientMutationId);
        });
    });

    it('Should return a dispatch in status returning in MailWise', {
        retries
    }, () => {
        skipOn(isDev());
        const variables = {
            id: dispatchId
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: queries.dispatch, variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const dispatch = response.body.data.dispatch;
            expect(dispatch).to.have.all.keys(PropertiesMW.dispatchWrap);
            expect(dispatch.id).to.eq(variables.id);
            expect(dispatch.status).to.eq('RETURNING');
            customerId = dispatch.order.customerId;
        });
    });

    it('Should return an order in status returning in MailWise', {
        retries
    }, () => {
        skipOn(isDev());
        cy.wait(5000);
        const variables = {
            filter: [
                {
                    customerId: {
                        eq: customerId
                    }
                }
            ]
        }
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: queries.orders, variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const order = response.body.data.orders;
            expect(order.edges.length).to.eq(1);
            const node = order.edges[0].node;
            expect(node).to.have.all.keys(PropertiesMW.order);
            expect(node.status).to.eq('RETURNING');
        });
    });

    it('Should return an expedition in status before returning in MailShip', { //MW-549
        retries
    }, () => {
        skipOn(isDev());
        cy.wait(10000);
        cy.request({
            url: `${urlMailShip}${Endpoints.MAILSHIP_EXPEDITION_LIST}`,
            method: 'POST',
            headers: msHeaders,
            body: {
                criteria:
                {
                    orderNumber:
                    {
                        eq: customerId
                    }
                }
            }
        }).then((response) => {
            expect(response).to.have.property('status', 200);
            const expedition = response.body.results[0];
            expect(expedition.orderNumber).to.eq(customerId);
            expect(expedition.status).to.eq(dispatchStatus.toLowerCase());
        });
    });
});
