import { PropertiesMW } from '../../support/constants/propertiesMailWise';
import moment from 'moment';
const urlMailWise = Cypress.config('urlMailWise');
const userMailWise = Cypress.config('userMailWise');
const queries = require('../../fixtures/mailwise/queries.json');
const mutations = require('../../fixtures/mailwise/mutations.json');

let headers = null;
let tokenMailWise = null;

describe('Product test', () => { //[MW-1218]
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

    const max = 19999;
    const prefix = 'Cy';
    let organisationId = null;
    let organisationName = null;
    let productSku = null;
    let productId = null;
    let productName = null;

    it('Should create an organisation in MailWise', () => {
        const variables = {
            name: cy.faker.lorem.words(),
            registrationNumber: `${prefix}${cy.faker.random.number(max)}`,
            vatNumber: `${prefix}${cy.faker.random.number(max)}`,
            country: 'CZ',
            addressLine1: cy.faker.address.cityName(),
            senderPhone: cy.faker.phone.phoneNumber(),
            senderEmail: cy.faker.internet.email(),
            tmsCustomerId: `${prefix}${cy.faker.random.number(max)}`,
            mailshipId: cy.faker.random.uuid()
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers,
            body: { query: mutations.organisationCreate, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const dataItem = response.body.data.organisationCreate.organisation;
            cy.log(`status = ${response.status} with organisationId = ${dataItem.id}`);
            organisationId = dataItem.id;
            organisationName = dataItem.name;
        });
    });

    it('Should create a product in MailWise', () => {
        const variables = {
            active: true,
            codes: [{
                type: `${prefix}${cy.faker.finance.account()}`,
                code: `${prefix}${cy.faker.random.number(max)}`
            }],
            organisationId: organisationId,
            name: cy.faker.lorem.words(),
            productSku: `${prefix}${cy.faker.finance.account()}`,
            internalSku: cy.faker.finance.account(),
            description: cy.faker.lorem.words(),
            internalMeasuresSource: 'MANUAL',
            weight: cy.faker.random.number(max),
            internalWeight: cy.faker.random.number(max),
            internalHeight: cy.faker.random.number(max),
            internalWidth: cy.faker.random.number(max),
            internalLength: cy.faker.random.number(max),
            length: cy.faker.random.number(max),
            width: cy.faker.random.number(max),
            height: cy.faker.random.number(max)
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers,
            body: { query: mutations.productCreate, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const dataItem = response.body.data.productCreate.product;
            expect(dataItem).to.have.all.keys(PropertiesMW.product);
            cy.log(`status = ${response.status} with productSku = ${dataItem.productSku}`);
            productSku = dataItem.productSku;
        });
    });

    it('Should return a created product in MailWise', () => {
        const variables = {
            filter: [
                {
                    productSku: {
                        eq: productSku
                    }
                }
            ]
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers,
            body: { query: queries.products, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const dataItem = response.body.data.products;
            const result = dataItem.edges[0];
            expect(dataItem.edges.length).to.eq(1);
            expect(dataItem).to.have.all.keys('pageInfo', 'totalCount', 'edges');
            expect(result).to.have.all.keys('cursor', 'node');
            expect(result.node).to.have.all.keys(PropertiesMW.products);
            expect(result.node.organisation).to.have.all.keys('id', 'name', 'allowUserEditSku');
            cy.log(`status = ${response.status} with productSku = ${result.node.productSku}`);
            productSku = result.node.productSku;
            productId = result.node.id;
            productName = result.node.name;
        });
    });

    it('Should update a product in MailWise', () => {
        const variablesToUpdate = {
            active: true,
            codes: [{
                type: `${prefix}${cy.faker.finance.account()}`,
                code: `${prefix}${cy.faker.random.number(max)}`
            }],
            size: null,
            useLotNumber: false,
            features: [],
            createdAt: moment().format(),
            changedAt: null,
            id: productId,
            productSku: productSku,
            internalSku: cy.faker.finance.account(),
            name: productName,
            description: cy.faker.lorem.words(),
            weight: cy.faker.random.number(max),
            height: cy.faker.random.number(max),
            width: cy.faker.random.number(max),
            length: cy.faker.random.number(max),
            internalWeight: cy.faker.random.number(max),
            internalHeight: cy.faker.random.number(max),
            internalWidth: cy.faker.random.number(max),
            internalLength: cy.faker.random.number(max),
            internalMeasuresSource: 'MANUAL',
            organisation: {
                id: organisationId,
                name: organisationName,
                allowUserEditSku: true
            },
            images: [],
            handlingUnits: [],
            organisationId: organisationId
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers,
            body: { query: mutations.productUpdate, variables: variablesToUpdate },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const dataItem = response.body.data.productUpdate.product;
            expect(dataItem).to.have.all.keys(PropertiesMW.product);
            cy.log(`status = ${response.status} with productSku = ${dataItem.productSku}`);
        });
    });
});