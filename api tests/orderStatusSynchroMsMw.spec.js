import { PropertiesMW } from '../../support/constants/propertiesMailWise';
import { Endpoints } from '../../support/constants/endpoints';
import moment from 'moment';

const urlMailShip = Cypress.config('urlMailShip');
const userMailShip = Cypress.config('adminMailShip');
const urlMailWise = Cypress.config('urlMailWise');
const userMailWise = Cypress.config('userMailWise');
const queries = require('../../fixtures/mailwise/queries.json');
const expedition = require(`../../fixtures/intMailShip/intExpedition-${Cypress.env('version')}.json`);

let mwHeaders = null;
let msHeaders = null;

describe('Order status synchronization MailShip-MailWise test', () => { //[MW-1392]
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

    let expeditionId = null;
    let orderNumber = null;
    let expeditionStatus = null;
    let responseExpedition = null;

    const createExpedition = () => ({
        ...expedition,
        orderNumber: cy.faker.finance.account(),
        note: cy.faker.lorem.words(),
        billingFirstName: cy.faker.name.firstName(),
        billingLastName: cy.faker.name.lastName(),
        billingDegree: cy.faker.name.prefix(),
        billingEmail: cy.faker.internet.email(),
        billingPhone: cy.faker.phone.phoneNumber(),
        billingRegistrationNumber: cy.faker.finance.account(),
        billingVatNumber: cy.faker.finance.account(),
        deliveryFirstName: cy.faker.name.firstName(),
        deliveryLastName: cy.faker.name.lastName(),
        deliveryDegree: cy.faker.name.prefix(),
        deliveryCompany: cy.faker.company.companyName(),
        deliveryStreet: cy.faker.address.streetName(),
        deliveryHouseNr: cy.faker.random.number(),
        deliveryZip: cy.faker.address.zipCode(),
        deliveryCity: cy.faker.address.cityName(),
        deliveryEmail: cy.faker.internet.email(),
        deliveryPhone: cy.faker.phone.phoneNumber(),
        requiredExpeditionDate: moment().add(5, 'days').format('YYYY-MM-DD'),
        value: cy.faker.random.number(),
        fragile: cy.faker.datatype.boolean(),
        codValue: cy.faker.random.number(),
        codVariableSymbol: cy.faker.finance.account(),
        customerGroup: cy.faker.lorem.word(),
        ref1: cy.faker.lorem.word(),
        ref2: cy.faker.lorem.word(),
        ref3: cy.faker.lorem.word(),
        eshopOrderDate: moment().add(0, 'days').format('YYYY-MM-DD')
    });

    const buildOrderVariables = (orderNumber) => {
        const variables = {
            filter: [
                {
                    customerId: {
                        eq: orderNumber
                    }
                }
            ]
        }
        return variables;
    }

    it('Should create an expedition in MailShip', () => {
        const expedition = createExpedition();
        cy.request({
            url: urlMailShip + Endpoints.MAILSHIP_EXPEDITION,
            method: 'POST',
            headers: msHeaders,
            body: expedition
        }).then((response) => {
            expect(response).to.have.property('status', 201);
            const result = response.body;
            expect(result).not.be.empty;
            cy.log(`MailShip expedition status = ${response.status} with orderNumber = ${response.body.orderNumber} and expeditionStatus = ${response.body.status}`);
            expeditionId = result.id;
            orderNumber = result.orderNumber;
            responseExpedition = result;
        });
    });

    it('Should return an expedition in MailWise created in Mailship', () => {
        cy.wait(5000);
        const variables = buildOrderVariables(orderNumber);
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
            expect(node.customerId).to.eq(responseExpedition.orderNumber);
            expect(node.status.toLowerCase()).to.eq(responseExpedition.status);
            expect(node.status).to.eq('ON_HOLD');
            cy.log(`status = ${response.status} with customerId = ${node.customerId}`);
        });
    });

    it('Should update status an expedition to awaiting processing in MailShip', () => {
        cy.request({
            url: `${urlMailShip}${Endpoints.MAILSHIP_EXPEDITION}/${expeditionId}/send`,
            method: 'PUT',
            headers: msHeaders
        }).then((response) => {
            expect(response).to.have.property('status', 200);
            const result = response.body;
            expect(result).not.be.empty;
            expect(result.id).to.eq(expeditionId);
            expeditionStatus = result.status;
        });
    });

    it('Should return an expedition (order) in MailWise updated in Mailship', () => {
        cy.wait(5000);
        const variables = buildOrderVariables(orderNumber);
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
            expect(node.customerId).to.eq(responseExpedition.orderNumber);
            expect(node.status.toLowerCase()).to.eq(expeditionStatus);
            expect(node.status).to.eq('AWAITING_PROCESSING');
        });
    });

    it('Should rollback expedition in MailShip', () => {
        cy.request({
            url: `${urlMailShip}${Endpoints.MAILSHIP_EXPEDITION}/${expeditionId}/rollback`,
            method: 'PUT',
            headers: msHeaders,
        }).then((response) => {
            expect(response).to.have.property('status', 200);
            const result = response.body;
            expect(result).not.be.empty;
            expect(result.id).to.eq(expeditionId);
            expect(result.status).to.eq('on_hold');
            expeditionStatus = result.status;   
        });
    });
    
    it('Should return an expedition (order) in MailWise returned back in Mailship', () => {
        cy.wait(5000);
        const variables = buildOrderVariables(orderNumber);
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
            expect(node.customerId).to.eq(responseExpedition.orderNumber);
            expect(node.status.toLowerCase()).to.eq(expeditionStatus);
            expect(node.status).to.eq('ON_HOLD');
        });
    });
    
    it('Should update status an expedition to awaiting processing in MailShip', () => {
        cy.request({
            url: `${urlMailShip}${Endpoints.MAILSHIP_EXPEDITION}/${expeditionId}/send`,
            method: 'PUT',
            headers: msHeaders
        }).then((response) => {
            expect(response).to.have.property('status', 200);
            const result = response.body;
            expect(result).not.be.empty;
            expect(result.id).to.eq(expeditionId);
            expeditionStatus = result.status;
        });
    });
    
    it('Should return an expedition (order) in MailWise updated in Mailship', () => {
        cy.wait(5000);
        const variables = buildOrderVariables(orderNumber);
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
            expect(node.customerId).to.eq(responseExpedition.orderNumber);
            expect(node.status.toLowerCase()).to.eq(expeditionStatus);
            expect(node.status).to.eq('AWAITING_PROCESSING');
        });
    });

    it('Should cancel an expedition in MailShip', () => {
        cy.request({
            url: `${urlMailShip}${Endpoints.MAILSHIP_EXPEDITION}/${expeditionId}/cancel`,
            method: 'PUT',
            headers: msHeaders
        }).then((response) => {
            expect(response).to.have.property('status', 204);
        });
    });

    it('Should not find an expedition in MailWise canceled in Mailship', () => {
        cy.wait(5000);
        const variables = buildOrderVariables(orderNumber);
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: queries.orders, variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const order = response.body.data.orders;
            expect(order.edges.length).to.eq(0);
        });
    });

    it('Should delete an expedition in MailShip', () => {
        cy.request({
            url: `${urlMailShip}${Endpoints.MAILSHIP_EXPEDITION}/${expeditionId}/delete`,
            method: 'PUT',
            headers: msHeaders,
        }).then((response) => {
            expect(response).to.have.property('status', 204);
        })
    });
});


