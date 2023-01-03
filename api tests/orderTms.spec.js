import { EndpointsTms } from '../../support/constants/endpointsTms';
import { PropertiesTMS } from '../../support/constants/propertiesMailTms';
import { skipOn } from '@cypress/skip-test';

const urlMailTms = Cypress.config('urlMailTms');
const order = require('../../fixtures/mailtms/order.json');
const carriers = require('../../fixtures/mailtms/carriers.json');

const isDev = () => {
    return Cypress.env('version') === 'dev';
}

describe('Order TMS E2E test', () => { //[MW-1866]

    let orderId = null;
    let requestSender = null;
    let requestReceiver = null;
    let requestParcel = null;

    const prefix = 'cy_order_';
    const retries = {
        runMode: 2,
        openMode: 2
    };

    const hasProperties = (entity, properties) => {
        properties.forEach(property => {
            expect(entity).to.have.property(property);
        });
    };

    carriers.forEach(carrier => {
        it('Should create order in MailTms', () => {
            skipOn(isDev());
            const orderCreate = {
                ...order,
                carrierId: carrier.carrierId,
                externalOrderId: `${prefix}${cy.faker.finance.account()}`,
                extraCarrierServices: carrier.extraCarrierServices
            };
            cy.request({
                url: urlMailTms + EndpointsTms.MAILTMS_ORDER_CREATE,
                method: 'POST',
                body: orderCreate
            }).then((response) => {
                expect(response).to.have.property('status', 200);
                expect(response.body).not.be.empty;
                expect(response.body).to.have.all.keys(PropertiesTMS.order);

                orderId = response.body.orderId;
                requestSender = order.sender;
                requestReceiver = order.receiver;
                requestParcel = order.parcels[0];

                cy.log(`status = ${response.status} with id = ${orderId}`);
                cy.log(`carrierId = ${carrier.carrierId} => ${orderCreate.carrierId}`);
            });
        });

        it('Should return order tracking in MailTms', {
            retries
        }, () => {
            skipOn(isDev());
            cy.wait(5000);
            cy.request({
                url: `${urlMailTms}${EndpointsTms.MAILTMS_ORDER_TRACKING}/${orderId}`,
                method: 'GET'
            }).then((response) => {
                const properties = PropertiesTMS.orderTracking;
                expect(response).to.have.property('status', 200);
                expect(response.body).not.be.empty;
                hasProperties(response.body, properties);
                expect(response.body.orderId).to.eq(orderId);
                const sender = response.body.sender;
                expect(sender).to.have.all.keys(PropertiesTMS.sender);
                expect(sender).to.deep.equals(requestSender);
                const receiver = response.body.receiver;
                expect(receiver).to.have.all.keys(PropertiesTMS.receiver);
                expect(receiver).to.deep.equals(requestReceiver);
                const parcel = response.body.parcels[0];
                expect(parcel).not.be.empty;
                expect(parcel.trackingUrl).not.be.empty;
                expect(parcel.parcelId).not.be.empty;
                expect(parcel.externalParcelId).to.eq(requestParcel.externalParcelId);
                expect(parcel.weight).to.eq(requestParcel.weight);
                expect(parcel.length).to.eq(requestParcel.length);
                expect(parcel.width).to.eq(requestParcel.width);
                expect(parcel.height).to.eq(requestParcel.height);
                const additionalInformation = response.body.additionalInformation;
                expect(additionalInformation).to.have.all.keys(PropertiesTMS.additionalInformation);
            });
        });

        it('Should cancel order in MailTms', {
            retries
        }, () => {
            skipOn(isDev());
            cy.request({
                url: `${urlMailTms}${EndpointsTms.MAILTMS_ORDER_CANCEL}/${orderId}`,
                method: 'GET'
            }).then((response) => {
                expect(response).to.have.property('status', 200);
                expect(response.body).not.be.empty;
                expect(response.body).to.have.all.key('canceling');
                expect(response.body.canceling).to.eq(orderId);
            })
        });
    });
});