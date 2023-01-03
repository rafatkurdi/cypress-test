import { PropertiesMW } from '../../support/constants/propertiesMailWise';
import { PropertiesMS } from '../../support/constants/propertiesMailShip';
import { Endpoints } from '../../support/constants/endpoints';
const urlMailShip = Cypress.config('urlMailShip');
const userMailShip = Cypress.config('adminMailShip');
const urlMailWise = Cypress.config('urlMailWise');
const userMailWise = Cypress.config('userMailWise');
const queries = require('../../fixtures/mailwise/queries.json');
const product = require(`../../fixtures/intMailShip/intProduct-${Cypress.env('version')}.json`);

let mwHeaders = null;
let msHeaders = null;

describe('Product synchronization MailShip-MailWise test', () => { //[MW-1280]

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

    const max = 19999;
    const prefix = 'Cy';
    let msProductId = null;
    let productSku = null;
    let internalSku = null;
    let productName = null;
    let description = null;
    let weight = null;
    let height = null;
    let width = null;
    let length = null;

    const modifyProduct = () => ({
        ...product,
        productSku: `${prefix}${cy.faker.finance.account()}`,
        internalSku: cy.faker.finance.account(),
        name: cy.faker.lorem.words(),
        description: cy.faker.lorem.words(),
        weight: cy.faker.random.number(max) + 1,
        height: cy.faker.random.number(max) + 1,
        width: cy.faker.random.number(max) + 1,
        length: cy.faker.random.number(max) + 1,
        referenceNumbers: [
            cy.faker.random.number(max) + 1
        ],
        hsCode: cy.faker.finance.account()
    });

    const buildProductVariables = (productSku) => {
        const variables = {
            filter: [
                {
                    productSku: {
                        eq: productSku
                    }
                }
            ]
        }
        return variables;
    }

    it('Should create a product in MailShip', () => {
        const product = modifyProduct();
        cy.request({
            url: urlMailShip + Endpoints.MAILSHIP_PRODUCT,
            method: 'POST',
            headers: msHeaders,
            body: product
        }).then((response) => {
            expect(response).to.have.property('status', 201);
            const result = response.body;
            expect(result).not.be.empty;
            expect(result).to.have.all.keys(PropertiesMS.product);
            cy.log(`MailShip product status = ${response.status} with productSku = ${result.productSku}`);
            msProductId = result.id;
            productName = result.name;
            productSku = result.productSku;
            internalSku = result.internalSku;
            description = result.description;
            weight = result.weight;
            height = result.height;
            width = result.width;
            length = result.length;
        });
    });

    it('Should return a product in MailWise created in Mailship', () => {
        cy.wait(5000);
        const variables = buildProductVariables(productSku);
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: queries.products, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const product = response.body.data.products;
            expect(product.edges.length).to.eq(1);
            const node = product.edges[0].node;
            expect(node).to.have.all.keys(PropertiesMW.products);
            expect(node.organisation).to.have.all.keys('id', 'name', 'allowUserEditSku');
            expect(node.name).to.eq(productName);
            expect(node.productSku).to.eq(productSku);
            expect(node.internalSku).to.eq(internalSku);
            expect(node.description).to.eq(description);
            expect(node.weight).to.eq(weight);
            expect(node.height).to.eq(height);
            expect(node.width).to.eq(width);
            expect(node.length).to.eq(length);
            cy.log(`status = ${response.status} with productSku = ${node.productSku}`);
        });
    });

    it('Should update a product in MailShip', () => {
        const productToUpdate = modifyProduct();
        cy.request({
            url: `${urlMailShip}${Endpoints.MAILSHIP_PRODUCT}/${msProductId}`,
            method: 'PUT',
            headers: msHeaders,
            body: productToUpdate
        }).then((response) => {
            expect(response).to.have.property('status', 200);
            const result = response.body;
            expect(result).not.be.empty;
            expect(result).to.have.all.keys(PropertiesMS.product);
            expect(result.id).to.eq(msProductId);
            expect(result.name).to.eq(productToUpdate.name);
            expect(result.productSku).to.eq(productToUpdate.productSku);
            expect(result.internalSku).to.eq(productToUpdate.internalSku);
            productName = result.name;
            productSku = result.productSku;
            internalSku = result.internalSku;
        });
    });

    it('Should return a product in MailWise updated in Mailship', () => {
        cy.wait(5000);
        const variables = buildProductVariables(productSku);
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: queries.products, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const product = response.body.data.products;
            expect(product.edges.length).to.eq(1);
            const node = product.edges[0].node;
            expect(node).to.have.all.keys(PropertiesMW.products);
            expect(node.name).to.eq(productName);
            expect(node.productSku).to.eq(productSku);
            expect(node.internalSku).to.eq(internalSku);
        });
    });

    it('Should activate a product in MailShip', () => {
        cy.request({
            url: `${urlMailShip}${Endpoints.MAILSHIP_PRODUCT_ACTIVATE}/${msProductId}`,
            method: 'PUT',
            headers: msHeaders,
        }).then((response) => {
            expect(response).to.have.property('status', 204);
        });
    });

    it('Should return a product in MailWise activated in MailShip', () => {
        const variables = buildProductVariables(productSku);
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: queries.products, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const product = response.body.data.products;
            expect(product.edges.length).to.eq(1);
            const node = product.edges[0].node;
            expect(node).to.have.all.keys(PropertiesMW.products);
            expect(node.productSku).to.eq(productSku);
            expect(node.active).to.eq(true);
        });
    });

    it('Should deactivate a product in MailShip', () => {
        cy.request({
            url: `${urlMailShip}${Endpoints.MAILSHIP_PRODUCT_DEACTIVATE}/${msProductId}`,
            method: 'PUT',
            headers: msHeaders,
        }).then((response) => {
            expect(response).to.have.property('status', 204);
        });
    });

    it('Should return a product in MailWise deactivated in MailShip', () => {
        const variables = buildProductVariables(productSku);
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: queries.products, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const product = response.body.data.products;
            expect(product.edges.length).to.eq(1);
            const node = product.edges[0].node;
            expect(node).to.have.all.keys(PropertiesMW.products);
            expect(node.productSku).to.eq(productSku);
            expect(node.active).to.eq(false);
        });
    });

    it('Should delete a product in MailShip', () => {
        cy.request({
            url: `${urlMailShip}${Endpoints.MAILSHIP_PRODUCT}/${msProductId}`,
            method: 'DELETE',
            headers: msHeaders
        }).then((response) => {
            expect(response).to.have.property('status', 204);
        });
    });

    it('Should not found a product in MailWise deleted in MailShip', () => {
        const variables = buildProductVariables(productSku);
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: queries.products, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const product = response.body.data.products;
            expect(product.edges.length).to.eq(0);
        });
    });
});