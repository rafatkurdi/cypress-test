import { PropertiesMW } from '../../support/constants/propertiesMailWise';
import { PropertiesMS } from '../../support/constants/propertiesMailShip';
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

describe('Order synchronization MailShip-MailWise test', () => { //[MW-1319, MW-1362]
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
    let productId = null;
    let orderId = null;
    let customerId = null;
    let readableId = null;
    let dispatchId = null;
    let orderNumber = null;
    let expeditionStatus = null;
    let responseOrder = null;
    let responseExpedition = null;
    let responseProduct = null;

    const retries = {
        runMode: 2,
        openMode: 2
    };

    const modifyExpedition = () => ({
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
        requiredExpeditionDate: moment().add(0, 'days').format('YYYY-MM-DD'),
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

    const buildDispatchVariables = (customerId) => {
        const variables = {
            filter: [
                {
                    customerId: {
                        eq: customerId
                    }
                }
            ]
        }
        return variables;
    }

    const buildOrderItemsVariables = (orderId) => {
        const variables = {
            filter: [
                {
                    orderId: {
                        eq: orderId
                    }
                }
            ]
        }
        return variables;
    }

    const buildDispatchItemsVariables = (dispatchId) => {
        const variables = {
            filter: [
                {
                    dispatchId: {
                        eq: dispatchId
                    }
                }
            ]
        }
        return variables;
    }

    it('Should create an expedition in MailShip', () => {
        const expedition = modifyExpedition();
        cy.request({
            url: urlMailShip + Endpoints.MAILSHIP_EXPEDITION,
            method: 'POST',
            headers: msHeaders,
            body: expedition
        }).then((response) => {
            expect(response).to.have.property('status', 201);
            const result = response.body;
            expect(result).not.be.empty;
            //expect(result).to.have.all.keys(PropertiesMS.expedition);
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
            expect(node.note).to.eq(responseExpedition.note);
            expect(node.billingFirstName).to.eq(responseExpedition.billingFirstName);
            expect(node.billingLastName).to.eq(responseExpedition.billingLastName);
            expect(node.billingDegree).to.eq(responseExpedition.billingDegree);
            expect(node.billingEmail).to.eq(responseExpedition.billingEmail);
            expect(node.billingPhone).to.eq(responseExpedition.billingPhone);
            expect(node.billingRegistrationNumber).to.eq(responseExpedition.billingRegistrationNumber);
            expect(node.billingVatNumber).to.eq(responseExpedition.billingVatNumber);
            expect(node.deliveryFirstName).to.eq(responseExpedition.deliveryFirstName);
            expect(node.deliveryLastName).to.eq(responseExpedition.deliveryLastName);
            expect(node.deliveryDegree).to.eq(responseExpedition.deliveryDegree);
            expect(node.deliveryCompany).to.eq(responseExpedition.deliveryCompany);
            expect(node.deliveryStreet).to.eq(responseExpedition.deliveryStreet);
            expect(node.deliveryHouseNr).to.eq(responseExpedition.deliveryHouseNr);
            expect(node.deliveryZip).to.eq(responseExpedition.deliveryZip);
            expect(node.deliveryCity).to.eq(responseExpedition.deliveryCity);
            expect(node.deliveryEmail).to.eq(responseExpedition.deliveryEmail);
            expect(node.deliveryPhone).to.eq(responseExpedition.deliveryPhone);
            expect(node.status.toLowerCase()).to.eq(responseExpedition.status);
            expect(node.requiredExpeditionDate).to.eq(responseExpedition.requiredExpeditionDate);
            expect(node.value).to.includes(responseExpedition.value);
            expect(node.fragile).to.eq(responseExpedition.fragile);
            expect(node.customerGroup).to.eq(responseExpedition.customerGroup);
            expect(node.ref1).to.eq(responseExpedition.ref1);
            expect(node.ref2).to.eq(responseExpedition.ref2);
            expect(node.ref3).to.eq(responseExpedition.ref3);
            expect(node.eshopOrderDate).to.eq(responseExpedition.eshopOrderDate);
            cy.log(`status = ${response.status} with customerId = ${node.customerId}`);
        });
    });

    it('Should update an expedition in MailShip', () => {
        const expeditionToUpdate = modifyExpedition();
        cy.request({
            url: `${urlMailShip}${Endpoints.MAILSHIP_EXPEDITION}/${expeditionId}`,
            method: 'PUT',
            headers: msHeaders,
            body: expeditionToUpdate
        }).then((response) => {
            expect(response).to.have.property('status', 200);
            const result = response.body;
            expect(result).not.be.empty;
            //expect(result).to.have.all.keys(PropertiesMS.expedition);
            expect(result.id).to.eq(expeditionId);
            expect(result.orderNumber).to.eq(expeditionToUpdate.orderNumber);
            cy.log(`MailShip expedition status = ${response.status} with orderNumber = ${response.body.orderNumber} and expeditionStatus = ${response.body.status}`);
            expeditionId = result.id;
            orderNumber = result.orderNumber;
            responseExpedition = result;
            productId = result.items[0].product;
        });
    });

    it('Should send an expedition to WMS in MailShip', () => {
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

    it('Should return expedited product in MailShip', () => {
        cy.request({
            url: `${urlMailShip}${Endpoints.MAILSHIP_PRODUCT}/${productId}`,
            method: 'GET',
            headers: msHeaders,
        }).then((response) => {
            expect(response).to.have.property('status', 200);
            const result = response.body;
            expect(result.id).to.eq(productId);
            responseProduct = result;
            cy.log(`status = ${response.status} with productSku = ${result.productSku}`);
        });
    });

    it('Should return an expedition (order) in MailWise updated in Mailship', {
        retries
    }, () => {
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
            expect(node.note).to.eq(responseExpedition.note);
            expect(node.billingFirstName).to.eq(responseExpedition.billingFirstName);
            expect(node.billingLastName).to.eq(responseExpedition.billingLastName);
            expect(node.billingDegree).to.eq(responseExpedition.billingDegree);
            expect(node.billingEmail).to.eq(responseExpedition.billingEmail);
            expect(node.billingPhone).to.eq(responseExpedition.billingPhone);
            expect(node.billingRegistrationNumber).to.eq(responseExpedition.billingRegistrationNumber);
            expect(node.billingVatNumber).to.eq(responseExpedition.billingVatNumber);
            expect(node.deliveryFirstName).to.eq(responseExpedition.deliveryFirstName);
            expect(node.deliveryLastName).to.eq(responseExpedition.deliveryLastName);
            expect(node.deliveryDegree).to.eq(responseExpedition.deliveryDegree);
            expect(node.deliveryCompany).to.eq(responseExpedition.deliveryCompany);
            expect(node.deliveryStreet).to.eq(responseExpedition.deliveryStreet);
            expect(node.deliveryHouseNr).to.eq(responseExpedition.deliveryHouseNr);
            expect(node.deliveryZip).to.eq(responseExpedition.deliveryZip);
            expect(node.deliveryCity).to.eq(responseExpedition.deliveryCity);
            expect(node.deliveryEmail).to.eq(responseExpedition.deliveryEmail);
            expect(node.deliveryPhone).to.eq(responseExpedition.deliveryPhone);
            expect(node.status.toLowerCase()).to.eq(expeditionStatus);
            expect(node.requiredExpeditionDate).to.eq(responseExpedition.requiredExpeditionDate);
            expect(node.value).to.includes(responseExpedition.value);
            expect(node.fragile).to.eq(responseExpedition.fragile);
            expect(node.codValue).to.includes(responseExpedition.codValue);
            expect(node.codVariableSymbol).to.eq(responseExpedition.codVariableSymbol);
            expect(node.customerGroup).to.eq(responseExpedition.customerGroup);
            expect(node.ref1).to.eq(responseExpedition.ref1);
            expect(node.ref2).to.eq(responseExpedition.ref2);
            expect(node.ref3).to.eq(responseExpedition.ref3);
            expect(node.eshopOrderDate).to.eq(responseExpedition.eshopOrderDate);
            cy.log(`status = ${response.status} with customerId = ${node.customerId}`);
            customerId = node.customerId;
            readableId = node.readableId;
            responseOrder = node;
            orderId = node.id;
        });
    });

    it('Should return an expedition (order) items in MailWise', () => {
        const variables = buildOrderItemsVariables(orderId);
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: queries.orderItems, variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const orderItem = response.body.data.orderItems;
            expect(orderItem.edges.length).to.be.greaterThan(0);
            const node = orderItem.edges[0].node;
            expect(node).to.have.all.keys(PropertiesMW.orderItem);
            expect(node.product).to.have.all.keys(PropertiesMW.productInOrder);
            expect(node.product.productSku).to.eq(responseProduct.productSku);
            expect(node.product.internalSku).to.eq(responseProduct.internalSku);
            responseProduct = node.product;
        });
    });

    it('Should return an created dispatch in MailWise', () => {
        const variables = buildDispatchVariables(customerId);
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: queries.dispatches, variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const dispatch = response.body.data.dispatches;
            expect(dispatch.edges.length).to.eq(1);
            const node = dispatch.edges[0].node;
            expect(node).to.have.all.keys(PropertiesMW.dispatch);
            expect(node.status).to.eq('WAITING');
            expect(node.note).to.eq(responseOrder.note);
            expect(node.blocked).to.eq(responseOrder.blocked);
            expect(node.itemCount).to.eq(responseOrder.itemCount);
            expect(node.productCount).to.eq(responseOrder.productCount);
            expect(node.total).to.eq(responseOrder.total);
            expect(node.pickedTotal).to.eq(responseOrder.pickedTotal);
            expect(node.notPickedTotal).to.eq(responseOrder.notPickedTotal);
            expect(node.bookedTotal).to.eq(responseOrder.bookedTotal);
            expect(node.notBookedTotal).to.eq(responseOrder.notBookedTotal);
            const order = node.order;
            expect(order).to.have.all.keys(PropertiesMW.order);
            expect(order.customerId).to.eq(customerId);
            expect(order.readableId).to.eq(readableId);
            for (const property in responseOrder) {
                expect(responseOrder[property]?.toString()).to.eq(order[property]?.toString());
            }
            dispatchId = node.id;
        });
    });

    it('Should return an dispatch items in MailWise', () => {
        const variables = buildDispatchItemsVariables(dispatchId);
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: queries.dispatchItems, variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const dispatchItem = response.body.data.dispatchItems;
            expect(dispatchItem.edges.length).to.be.greaterThan(0);
            const node = dispatchItem.edges[0].node;
            expect(node).to.have.all.keys(PropertiesMW.dispatchItem);
            const product = node.orderItem.product;
            expect(product.id).to.eq(responseProduct.id);
            expect(product.name).to.eq(responseProduct.name);
            expect(product.productSku).to.eq(responseProduct.productSku);
            expect(product.internalSku).to.eq(responseProduct.internalSku);
        });
    });
});
