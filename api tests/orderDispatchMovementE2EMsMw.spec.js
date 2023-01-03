import { PropertiesMW } from '../../support/constants/propertiesMailWise';
import { PropertiesMS } from '../../support/constants/propertiesMailShip';
import { PropertiesTMS } from '../../support/constants/propertiesMailTms';
import { Endpoints } from '../../support/constants/endpoints';
import { EndpointsTms } from '../../support/constants/endpointsTms';
import moment from 'moment';
import { skipOn } from '@cypress/skip-test';

const urlMailShip = Cypress.config('urlMailShip');
const userMailShip = Cypress.config('adminMailShip');
const urlMailWise = Cypress.config('urlMailWise');
const userMailWise = Cypress.config('userMailWise');
const urlMailTms = Cypress.config('urlMailTms');
const accessKey = Cypress.config('accessKey');
const queries = require('../../fixtures/mailwise/queries.json');
const mutations = require('../../fixtures/mailwise/mutations.json');
const expedition = require(`../../fixtures/intMailShip/intExpedition-${Cypress.env('version')}.json`);
const picker = require(`../../fixtures/intMailWise/intPicker-${Cypress.env('version')}.json`);
const locationBoxVariables = require(`../../fixtures/intMailWise/intLocationBoxCreate-${Cypress.env('version')}.json`);

let mwHeaders = null;
let msHeaders = null;
let mwwHeaders = null;

const isDev = () => {
    return Cypress.env('version') === 'dev';
}

describe('Order-dispatch-movement synchronization MailShip-MailWise E2E test', () => { //[MW-1443, MW-1471, MW-1486, MW-1557, MW-1706]
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
            mwwHeaders = {
                authorization: accessKey
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
    let dispatchReadableId = null;
    let dispatchItemBookingId = null;
    let orderNumber = null;
    let expeditionStatus = null;
    let responseOrder = null;
    let responseExpedition = null;
    let responseProduct = null;
    let processJobId = null;
    let waveReadableId = null;
    let waveId = null;
    let locationId = null;
    let workstationId = null;
    let packagingId = null;
    let parcelId = null;
    let number = null;
    let trackingId = null;
    let extPackageNumber = null;
    let tmsId = null;

    const max = 19999;
    const retries = {
        runMode: 3,
        openMode: 3
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
        deliveryCity: cy.faker.address.cityName(),
        deliveryEmail: cy.faker.internet.email(),
        deliveryPhone: cy.faker.phone.phoneNumber(),
        requiredExpeditionDate: moment().add(0, 'days').format('YYYY-MM-DD'),
        value: cy.faker.random.number(),
        fragile: cy.faker.datatype.boolean(),
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

    it('Should return an expedition (order) in MailWise created in Mailship', () => {
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
            dispatchReadableId = node.readableId;
        });
    });

    it('Should allocate an dispatch in MailWise', () => {
        const variables = {
            filters: [
                {
                    id: {
                        eq: dispatchId
                    }
                }
            ],
            locationTypes: [
                'PICKING'
            ]
        }
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: mutations.dispatchesAllocate, variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const processJob = response.body.data.dispatchesAllocate.processJob;
            expect(processJob).to.have.all.keys(PropertiesMW.processJob);
            expect(processJob.name).to.eq('dispatch_allocation');
            expect(processJob.type).to.eq('DISPATCH_ALLOCATION');
            expect(processJob.status).to.eq('WAITING');
            processJobId = processJob.id;
        });
    });

    it('Should return an process job dispatch allocation in status finished in MailWise', {
        retries
    }, () => {
        cy.wait(5000);
        const variables = {
            id: processJobId
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: queries.processJob, variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const processJob = response.body.data.processJob;
            expect(processJob).to.have.all.keys(PropertiesMW.processJob);
            expect(processJob.type).to.eq('DISPATCH_ALLOCATION');
            expect(processJob.name).to.eq('dispatch_allocation');
            expect(processJob.finishedAt).to.not.be.null;
            expect(processJob.status).to.eq('FINISHED');
            cy.log(`status = ${response.status} with process job status = ${processJob.status}`);
        });
    });

    it('Should return an dispatch in status allocated in MailWise', () => {
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
            expect(node.status).to.eq('ALLOCATED');
            expect(node.note).to.eq(responseOrder.note);
            expect(node.blocked).to.eq(responseOrder.blocked);
            expect(node.itemCount).to.eq(responseOrder.itemCount);
            expect(node.productCount).to.eq(responseOrder.productCount);
            expect(node.total).to.eq(responseOrder.total);
            expect(node.pickedTotal).to.eq(responseOrder.pickedTotal);
            expect(node.notPickedTotal).to.eq(responseOrder.notPickedTotal);
            expect(node.bookedTotal).to.eq(responseOrder.total);
            expect(node.notBookedTotal).to.eq(0);
            const order = node.order;
            expect(order).to.have.all.keys(PropertiesMW.order);
            expect(order.customerId).to.eq(customerId);
            expect(order.readableId).to.eq(readableId);
            dispatchId = node.id;
            dispatchReadableId = node.readableId;
        });
    });

    it('Should wave an dispatch in MailWise', () => {
        const variables = {
            filters: [
                {
                    id: {
                        eq: dispatchId
                    }
                }
            ],
            method: 'WAVE_PER_DISPATCH'
        }
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: mutations.dispatchesWave, variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const processJob = response.body.data.dispatchesWave.processJob;
            expect(processJob).to.have.all.keys(PropertiesMW.processJob);
            expect(processJob.name).to.eq('dispatch_waving');
            expect(processJob.type).to.eq('DISPATCH_WAVING');
            expect(processJob.status).to.eq('WAITING');
            processJobId = processJob.id;
        });
    });

    it('Should return an process job dispatch waving in status finished in MailWise', {
        retries
    }, () => {
        cy.wait(5000);
        const variables = {
            id: processJobId
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: queries.processJob, variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const processJob = response.body.data.processJob;
            expect(processJob).to.have.all.keys(PropertiesMW.processJob);
            expect(processJob.type).to.eq('DISPATCH_WAVING');
            expect(processJob.name).to.eq('dispatch_waving');
            expect(processJob.finishedAt).to.not.be.null;
            expect(processJob.status).to.eq('FINISHED');
            cy.log(`status = ${response.status} with process job status = ${processJob.status}`);
        });
    });

    it('Should return an dispatch in status waved in MailWise', {
        retries
    }, () => {
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
            expect(node.status).to.eq('WAVED');
            expect(node.note).to.eq(responseOrder.note);
            expect(node.blocked).to.eq(responseOrder.blocked);
            expect(node.itemCount).to.eq(responseOrder.itemCount);
            expect(node.productCount).to.eq(responseOrder.productCount);
            expect(node.total).to.eq(responseOrder.total);
            expect(node.pickedTotal).to.eq(responseOrder.pickedTotal);
            expect(node.notPickedTotal).to.eq(responseOrder.notPickedTotal);
            expect(node.bookedTotal).to.eq(responseOrder.total);
            expect(node.notBookedTotal).to.eq(0);
            const order = node.order;
            expect(order).to.have.all.keys(PropertiesMW.order);
            expect(order.customerId).to.eq(customerId);
            expect(order.readableId).to.eq(readableId);
            const wave = node.items[0].bookings[0].wave;
            expect(wave.status).to.eq('WAITING');
            dispatchId = node.id;
            dispatchReadableId = node.readableId;
            waveReadableId = wave.readableId;
        });
    });

    it('Should return a wave in status waiting in MailWise', {
        retries
    }, () => {
        const variables = {
            filter: [
                {
                    readableId: {
                        eq: waveReadableId
                    }
                }
            ]
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: queries.waves, variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const wave = response.body.data.waves;
            expect(wave.edges.length).to.eq(1);
            const node = wave.edges[0].node;
            expect(node).to.have.all.keys(PropertiesMW.waves);
            expect(node.status).to.eq('WAITING');
            expect(node.readableId).to.eq(waveReadableId);
            cy.log(`status = ${response.status} with wave status = ${node.status}`);
            waveReadableId = node.readableId;
            waveId = node.id;
        });
    });

    it('Should assign picker to the wave in MailWise', {
        retries
    }, () => {
        const variables = {
            userId: picker.pickerId,
            id: waveId
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: mutations.waveAssign, variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const wave = response.body.data.waveAssign.wave;
            expect(wave).to.have.all.keys(PropertiesMW.waveAssign);
            expect(wave.id).to.eq(variables.id);
            expect(wave.pickedBy.id).to.eq(variables.userId);
            waveId = wave.id;
        });
    });

    it('Should return a wave in status assigned in MailWise', {
        retries
    }, () => {
        const variables = {
            filter: [
                {
                    id: {
                        eq: waveId
                    }
                }
            ]
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: queries.waves, variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const wave = response.body.data.waves;
            expect(wave.edges.length).to.eq(1);
            const node = wave.edges[0].node;
            expect(node).to.have.all.keys(PropertiesMW.waves);
            expect(node.status).to.eq('ASSIGNED');
            expect(node.id).to.eq(waveId);
            cy.log(`status = ${response.status} with wave status = ${node.status}`);
            waveId = node.id;
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
            const wave = node.bookings[0].wave;
            expect(wave.id).to.eq(waveId);
            expect(wave.readableId).to.eq(waveReadableId);
            dispatchItemBookingId = node.bookings[0].id;
            number = node.number;
            productId = product.id;
        });
    });

    it('Should create a location with type BOX in MailWise', () => {
        const variables = {
            ...locationBoxVariables,
            code: cy.faker.lorem.words()
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: mutations.locationCreate, variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const location = response.body.data.locationCreate.location;
            expect(location).to.have.all.keys(PropertiesMW.location);
            locationId = location.id;
        });
    });

    it('Should pick a wave and set status picked for dispatchItemBooking in MailWise', {
        retries
    }, () => {
        const variables = {
            input: {
                id: dispatchItemBookingId,
                locationId
            }
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: mutations.dispatchItemBookingPick, variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const dispatchItemBooking = response.body.data.dispatchItemBookingPick.dispatchItemBooking;
            expect(dispatchItemBooking).to.have.all.keys(PropertiesMW.dispatchItemBooking);
            expect(dispatchItemBooking.id).to.eq(variables.input.id);
            expect(dispatchItemBooking.status).to.eq('PICKED');
            const location = dispatchItemBooking.pickedToStocks[0].productStock.location;
            expect(location.id).to.eq(variables.input.locationId);
            locationId = location.id;
        });
    });

    it('Should return the movement in status pick in MailWise', () => {
        const variables = {
            filter: [
                {
                    dispatchReadableId: {
                        eq: dispatchReadableId
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
            expect(result.type).to.eq('PICK');
            expect(result.number).to.eq(number);
            const product = result.product;
            expect(product).to.have.all.keys(PropertiesMW.productMovement);
            expect(product.id).to.eq(productId);
            expect(product.productSku).to.eq(responseProduct.productSku);
            expect(product.internalSku).to.eq(responseProduct.internalSku);
            const receipt = result.receiptItem.receipt;
            expect(receipt).to.have.all.keys(PropertiesMW.receiptMovement);
            expect(receipt.type).to.eq('SUPPLY');
        });
    });

    it('Should return an order in status completion in MailWise', () => {
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
            expect(node.status).to.eq('COMPLETION');
        });
    });

    it('Should return an expedition in status completion in MailShip', {
        retries
    }, () => {
        cy.wait(5000);
        cy.request({
            url: `${urlMailShip}${Endpoints.MAILSHIP_EXPEDITION}/${expeditionId}`,
            method: 'GET',
            headers: msHeaders,
        }).then((response) => {
            expect(response).to.have.property('status', 200);
            expect(response.body.id).to.eq(expeditionId);
            expect(response.body.status).to.eq('completion');
        });
    });

    it('Should return a workstation in MailWrap', () => {
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwwHeaders,
            body: { query: queries.workstations },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const workstations = response.body.data.workstations;
            const result = workstations.edges[2].node;
            expect(result).to.have.all.keys(PropertiesMW.workstations);
            workstationId = result.id;
        });
    });

    it('Should create a packaging for dispatch in MailWrap', {
        retries
    }, () => {
        const variables = {
            name: cy.faker.lorem.word(),
            type: 'box',
            code: cy.faker.lorem.word(),
            weight: cy.faker.random.number(max),
            height: cy.faker.random.number(max),
            length: cy.faker.random.number(max),
            width: cy.faker.random.number(max)
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: mutations.packagingCreate, variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const packaging = response.body.data.packagingCreate.packaging;
            expect(packaging).to.have.key('id');
            packagingId = packaging.id;
        });
    });

    it('Should return a locationProductDispatchItemBookingStocks for dispatch in MailWrap', () => {
        const variables = {
            filter: [
                {
                    dispatchId: {
                        eq: dispatchId
                    }
                }
            ]
        }
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwwHeaders,
            body: { query: queries.locationProductDispatchItemBookingStocks, variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const node = response.body.data.locationProductDispatchItemBookingStocks.edges[0].node;
            expect(node).to.have.all.keys(PropertiesMW.locationProductDispatchItemBookingStocks);
            const dispatchItemBooking = node.dispatchItemBooking;
            expect(dispatchItemBooking.id).to.eq(dispatchItemBookingId);
            number = dispatchItemBooking.number;
            const productStock = node.productStock;
            locationId = productStock.location.id;
        });
    });

    it('Should create a parcel for dispatch in MailWrap', {
        retries
    }, () => {
        cy.wait(5000);
        const variables = {
            dispatchId,
            packagingId,
            workstationId
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwwHeaders,
            body: { query: mutations.parcelCreate, variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const parcel = response.body.data.parcelCreate.parcel;
            expect(parcel).to.have.all.keys(PropertiesMW.parcelCreate);
            expect(parcel.status).to.eq('PACKING');
            parcelId = parcel.id;
        });
    });

    it('Should add product from location to parcel in MailWrap', {
        retries
    }, () => {
        const variables = {
            id: parcelId,
            productId,
            locationId,
            number
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwwHeaders,
            body: { query: mutations.parcelAddProductFromLocation, variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const parcelAddProductFromLocation = response.body.data.parcelAddProductFromLocation.parcelItem;
            expect(parcelAddProductFromLocation).to.have.all.keys(PropertiesMW.parcelAddProductFromLocation);
            expect(parcelAddProductFromLocation.number).to.eq(variables.number);
        });
    });

    it('Should finish a parcel in MailWrap', {
        retries
    }, () => {
        const variables = {
            id: parcelId
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwwHeaders,
            body: { query: mutations.parcelFinish, variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const parcel = response.body.data.parcelFinish.parcel;
            expect(parcel).to.have.all.keys(PropertiesMW.parcelFinish);
            expect(parcel.status).to.eq('PACKED');
            expect(parcel.dispatch.id).to.eq(dispatchId);
        });
    });

    it('Should return a dispatch in status checking in MailWrap', {
        retries
    }, () => {
        const variables = {
            id: dispatchId
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwwHeaders,
            body: { query: queries.dispatch, variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const dispatch = response.body.data.dispatch;
            expect(dispatch).to.have.all.keys(PropertiesMW.dispatchWrap);
            expect(dispatch.id).to.eq(variables.id);
            expect(dispatch.status).to.eq('CHECKING');
            const orderItem = dispatch.items[0].orderItem;
            const product = orderItem.product;
            expect(product.id).to.eq(responseProduct.id);
            expect(product.productSku).to.eq(responseProduct.productSku);
            expect(product.internalSku).to.eq(responseProduct.internalSku);
            dispatchId = dispatch.id;
        });
    });

    it('Should return a parcel with tracking id for dispatch in MailWrap', () => {
        skipOn(isDev());
        const variables = {
            filter: [
                {
                    dispatchId: {
                        eq: dispatchId
                    }
                }
            ]
        }
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwwHeaders,
            body: { query: queries.parcels, variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const parcels = response.body.data.parcels;
            expect(parcels.edges.length).to.eq(1);
            const node = parcels.edges[0].node;
            expect(node).to.have.all.keys(PropertiesMW.parcels);
            expect(node.status).to.eq('PACKED');
            expect(node.dispatch).to.have.all.keys(PropertiesMW.dispatchParcel);
            expect(node.label).to.have.all.keys(PropertiesMW.label);
            expect(node.dispatch.id).to.eq(dispatchId);
            dispatchId = node.dispatch.id;
            trackingId = node.label.extPackageTrackingNumber;
        });
    });

    it('Should check a parcel for dispatch in MailWrap', {
        retries
    }, () => {
        skipOn(isDev());
        const variables = {
            id: parcelId,
            trackingId
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwwHeaders,
            body: { query: mutations.parcelCheck, variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const parcel = response.body.data.parcelCheck.parcel;
            expect(parcel).to.have.all.keys(PropertiesMW.parcelCheck);
            expect(parcel.status).to.eq('CHECKED');
            expect(parcel.id).to.eq(variables.id);
            expect(parcel.label.extPackageTrackingNumber).to.eq(trackingId);
        });
    });

    it('Should return a dispatch with TMS data in status waiting for the carrier in MailWise', {
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
            expect(dispatch.tmsId).not.be.empty;
            expect(dispatch.status).to.eq('WAITING_FOR_THE_CARRIER');
            const orderItem = dispatch.items[0].orderItem;
            const product = orderItem.product;
            expect(product.id).to.eq(responseProduct.id);
            expect(product.productSku).to.eq(responseProduct.productSku);
            expect(product.internalSku).to.eq(responseProduct.internalSku);
            const label = dispatch.labels[0];
            expect(label).to.have.all.keys(PropertiesMW.labels);
            expect(label.extPackageTrackingNumber).to.eq(trackingId);
            expect(label.extPackageNumber).to.eq(trackingId);
            expect(label.labelUrl).not.be.empty;
            dispatchId = dispatch.id;
            tmsId = dispatch.tmsId;
            extPackageNumber = label.extPackageNumber;
        });
    });

    it('Should return order tracking in MailTms', {
        retries
    }, () => {
        skipOn(isDev());
        cy.wait(5000);
        cy.request({
            url: `${urlMailTms}${EndpointsTms.MAILTMS_ORDER_TRACKING}/${tmsId}`,
            method: 'GET'
        }).then((response) => {
            expect(response).to.have.property('status', 200);
            const orderTracking = response.body;
            expect(orderTracking).not.be.empty;   
            expect(orderTracking).to.have.all.keys(PropertiesTMS.orderTrackingInternal);
            expect(orderTracking.orderId).to.eq(tmsId);
            const sender = orderTracking.sender;
            expect(sender).to.have.all.keys(PropertiesTMS.sender);
            const receiver = orderTracking.receiver;
            expect(receiver).to.have.all.keys(PropertiesTMS.receiver);
            const parcel = orderTracking.parcels[0];
            expect(parcel).not.be.empty;
            expect(parcel.parcelId).not.be.empty;
            expect(parcel.externalParcelId).to.eq(parcelId);
            const additionalInformation = orderTracking.additionalInformation;
            expect(additionalInformation).to.have.all.keys(PropertiesTMS.additionalInformation);
        });
    });

    it('Should return an order in status waiting for the carrier in MailWise', {
        retries
    }, () => {
        skipOn(isDev());
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
            expect(node.status).to.eq('WAITING_FOR_THE_CARRIER');
            expect(node.trackingNumber).to.eq(trackingId);
            expect(node.externalTrackingNumber).to.eq(extPackageNumber);
        });
    });

    it('Should return an expedition in status waiting for the carrier in MailShip', {
        retries
    }, () => {
        skipOn(isDev());
        cy.wait(10000);
        cy.request({
            url: `${urlMailShip}${Endpoints.MAILSHIP_EXPEDITION}/${expeditionId}`,
            method: 'GET',
            headers: msHeaders,
        }).then((response) => {
            expect(response).to.have.property('status', 200);
            expect(response.body.id).to.eq(expeditionId);
            expect(response.body.status).to.eq('waiting_for_the_carrier');
            expect(response.body.externalTrackingNumber).to.eq(extPackageNumber);
            expect(response.body.trackingNumber).to.eq(trackingId);
        });
    });

    it('Should return the movement in status take out in MailWise', () => {
        skipOn(isDev());
        const variables = {
            filter: [
                {
                    dispatchReadableId: {
                        eq: dispatchReadableId
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
            expect(result.type).to.eq('TAKE_OUT');
            expect(result.number).to.eq(number);
            const product = result.product;
            expect(product).to.have.all.keys(PropertiesMW.productMovement);
            expect(product.id).to.eq(productId);
            expect(product.productSku).to.eq(responseProduct.productSku);
            expect(product.internalSku).to.eq(responseProduct.internalSku);
            const receipt = result.receiptItem.receipt;
            expect(receipt).to.have.all.keys(PropertiesMW.receiptMovement);
            expect(receipt.type).to.eq('SUPPLY');
        });
    });

    it('Should change the dispatch status by the user in MailWise', {
        retries
    }, () => {
        skipOn(isDev());
        const variables = {
            id: dispatchId,
            status: 'CARRIER_PICKED_UP',
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

    it('Should return a dispatch in status carrier picked up in MailWise', {
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
            expect(dispatch.status).to.eq('CARRIER_PICKED_UP');
            const orderItem = dispatch.items[0].orderItem;
            const product = orderItem.product;
            expect(product.id).to.eq(responseProduct.id);
            expect(product.productSku).to.eq(responseProduct.productSku);
            expect(product.internalSku).to.eq(responseProduct.internalSku);
            const label = dispatch.labels[0];
            expect(label).to.have.all.keys(PropertiesMW.labels);
            expect(label.extPackageTrackingNumber).to.eq(trackingId);
        });
    });

    it('Should return an order in status carrier picked up in MailWise', {
        retries
    }, () => {
        skipOn(isDev());
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
            expect(node.status).to.eq('CARRIER_PICKED_UP');
        });
    });

    it('Should return an expedition in status carrier picked up in MailShip', {
        retries
    }, () => {
        skipOn(isDev());
        cy.wait(10000);
        cy.request({
            url: `${urlMailShip}${Endpoints.MAILSHIP_EXPEDITION}/${expeditionId}`,
            method: 'GET',
            headers: msHeaders,
        }).then((response) => {
            expect(response).to.have.property('status', 200);
            expect(response.body.id).to.eq(expeditionId);
            expect(response.body.status).to.eq('carrier_picked_up');
        });
    });

    it('Should change the dispatch status by the user in MailWise', {
        retries
    }, () => {
        skipOn(isDev());
        const variables = {
            id: dispatchId,
            status: 'DELIVERED',
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

    it('Should return a dispatch in status delivered in MailWise', {
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
            expect(dispatch.status).to.eq('DELIVERED');
            const orderItem = dispatch.items[0].orderItem;
            const product = orderItem.product;
            expect(product.id).to.eq(responseProduct.id);
            expect(product.productSku).to.eq(responseProduct.productSku);
            expect(product.internalSku).to.eq(responseProduct.internalSku);
            const label = dispatch.labels[0];
            expect(label).to.have.all.keys(PropertiesMW.labels);
            expect(label.extPackageTrackingNumber).to.eq(trackingId);
        });
    });

    it('Should return an order in status delivered in MailWise', {
        retries
    }, () => {
        skipOn(isDev());
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
            expect(node.status).to.eq('DELIVERED');
        });
    });

    it('Should return a stock movement in MailShip', {
        retries
    }, () => {
        skipOn(isDev());
        cy.wait(5000);
        cy.request({
            url: `${urlMailShip}${Endpoints.MAILSHIP_STOCK_MOVEMENT_LIST}`,
            method: 'POST',
            headers: msHeaders,
            body: {
                criteria: {
                    expedition: {
                        eq: expeditionId
                    },
                    movementType: {
                        eq: 'out'
                    }
                }
            }
        }).then((response) => {
            expect(response).to.have.property('status', 200);
            expect(response.body).not.be.empty;
            const stockMovement = response.body.results[0];
            expect(stockMovement).to.have.all.keys(PropertiesMS.stockMovements);
            expect(stockMovement.movementType).to.eq('out');
            expect(stockMovement.movementSubType).to.eq('completion');
            expect(stockMovement.quantity).to.eq(number);
        });
    });

    it('Should return an expedition in status delivered up in MailShip', {
        retries
    }, () => {
        skipOn(isDev());
        cy.wait(10000);
        cy.request({
            url: `${urlMailShip}${Endpoints.MAILSHIP_EXPEDITION}/${expeditionId}`,
            method: 'GET',
            headers: msHeaders,
        }).then((response) => {
            expect(response).to.have.property('status', 200);
            expect(response.body.id).to.eq(expeditionId);
            expect(response.body.status).to.eq('delivered');
        });
    });
});
