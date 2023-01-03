import { PropertiesMW } from '../../support/constants/propertiesMailWise';
import { PropertiesMS } from '../../support/constants/propertiesMailShip';
import { Endpoints } from '../../support/constants/endpoints';
const urlMailShip = Cypress.config('urlMailShip');
const userMailShip = Cypress.config('adminMailShip');
const urlMailWise = Cypress.config('urlMailWise');
const userMailWise = Cypress.config('userMailWise');
const queries = require('../../fixtures/mailwise/queries.json');
const supplier = require(`../../fixtures/mailship/supplier.json`);
const organisation = require(`../../fixtures/intMailShip/intOrganisation-${Cypress.env('version')}.json`);

let mwHeaders = null;
let msHeaders = null;

describe('Supplier synchronization MailShip-MailWise test', () => { //[MW-1582]

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

    let msSupplierId = null;
    let registrationNumber = null;
    let responseSupplier = null;
    let prefix = 'CZ';
    const max = 999999;
    const retries = {
        runMode: 2,
        openMode: 2
    };
    const modifySupplier = () => ({
        ...supplier,
        organisation: organisation.id,
        name: cy.faker.lorem.words(),
        companyName: cy.faker.address.cityName(),
        registrationNumber: `${cy.faker.random.number(max) + 1}`,
        vatNumber: `${prefix}${cy.faker.random.number(max)}`,
        active: true
    });
    const buildSupplierVariables = (registrationNumber) => {
        const variables = {
            filter: [
                {
                    registrationNumber: {
                        eq: registrationNumber
                    }
                }
            ]
        }
        return variables;
    }

    it('Should create a supplier in MailShip', () => {
        const supplier = modifySupplier();
        cy.request({
            url: urlMailShip + Endpoints.MAILSHIP_SUPPLIER,
            method: 'POST',
            headers: msHeaders,
            body: supplier
        }).then((response) => {
            expect(response).to.have.property('status', 201);
            const result = response.body;
            expect(result).not.be.empty;
            expect(result).to.have.all.keys(PropertiesMS.suppliers);
            cy.log(`MailShip supplier status = ${response.status} with registrationNumber = ${result.registrationNumber}`);
            msSupplierId = result.id;
            registrationNumber = result.registrationNumber;
            responseSupplier = result;
        });
    });

    it('Should return a supplier in MailWise created in Mailship', {
        retries
    }, () => {
        cy.wait(5000);
        const variables = buildSupplierVariables(registrationNumber);
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: queries.suppliers, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const supplier = response.body.data.suppliers;
            expect(supplier.edges.length).to.eq(1);
            const node = supplier.edges[0].node;
            expect(node).to.have.all.keys(PropertiesMW.suppliers);
            expect(node.name).to.eq(responseSupplier.name);
            expect(node.companyName).to.eq(responseSupplier.companyName);
            expect(node.firstName).to.eq(responseSupplier.firstName);
            expect(node.lastName).to.eq(responseSupplier.lastName);
            expect(node.degree).to.eq(responseSupplier.degree);
            expect(node.degree2).to.eq(responseSupplier.degree2);
            expect(node.street).to.eq(responseSupplier.street);
            expect(node.houseNr).to.eq(responseSupplier.houseNr);
            expect(node.city).to.eq(responseSupplier.city);
            expect(node.zip).to.eq(responseSupplier.zip);
            expect(node.country).to.eq(responseSupplier.country);
            expect(node.phone).to.eq(responseSupplier.phone);
            expect(node.email).to.eq(responseSupplier.email);
            expect(node.registrationNumber).to.eq(responseSupplier.registrationNumber);
            expect(node.vatNumber).to.eq(responseSupplier.vatNumber);
            expect(node.note).to.eq(responseSupplier.note);
            expect(node.ref1).to.eq(responseSupplier.ref1);
            expect(node.ref2).to.eq(responseSupplier.ref2);
            expect(node.ref3).to.eq(responseSupplier.ref3);
            expect(node.active).to.eq(responseSupplier.active);
            expect(node.organisation).to.have.key('name');
            cy.log(`status = ${response.status} with registrationNumber = ${node.registrationNumber}`);
        });
    });

    it('Should update a supplier in MailShip', () => {
        const supplierToUpdate = modifySupplier();
        cy.request({
            url: `${urlMailShip}${Endpoints.MAILSHIP_SUPPLIER}/${msSupplierId}`,
            method: 'PUT',
            headers: msHeaders,
            body: supplierToUpdate
        }).then((response) => {
            expect(response).to.have.property('status', 200);
            const result = response.body;
            expect(result).not.be.empty;
            expect(result).to.have.all.keys(PropertiesMS.suppliers);
            expect(result.id).to.eq(msSupplierId);
            expect(result.name).to.eq(supplierToUpdate.name);
            expect(result.companyName).to.eq(supplierToUpdate.companyName);
            expect(result.registrationNumber).to.eq(supplierToUpdate.registrationNumber);
            expect(result.vatNumber).to.eq(supplierToUpdate.vatNumber);
            expect(result.active).to.eq(supplierToUpdate.active);
            msSupplierId = result.id;
            registrationNumber = result.registrationNumber;
            responseSupplier = result;
        });
    });

    it('Should return a supplier in MailWise updated in Mailship', {
        retries
    }, () => {
        cy.wait(5000);
        const variables = buildSupplierVariables(registrationNumber);
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: queries.suppliers, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const supplier = response.body.data.suppliers;
            expect(supplier.edges.length).to.eq(1);
            const node = supplier.edges[0].node;
            expect(node).to.have.all.keys(PropertiesMW.suppliers);
            expect(node.name).to.eq(responseSupplier.name);
            expect(node.companyName).to.eq(responseSupplier.companyName);
            expect(node.registrationNumber).to.eq(responseSupplier.registrationNumber);
            expect(node.vatNumber).to.eq(responseSupplier.vatNumber);
            expect(node.active).to.eq(responseSupplier.active);
        });
    });

    it('Should deactivate a supplier in MailShip', {
        retries
    }, () => {
        cy.request({
            url: `${urlMailShip}${Endpoints.MAILSHIP_SUPPLIER_DEACTIVATE}/${msSupplierId}`,
            method: 'PUT',
            headers: msHeaders
        }).then((response) => {
            expect(response).to.have.property('status', 204);
        });
    });

    it('Should return a supplier in MailWise deactivated in MailShip', {
        retries
    }, () => {
        cy.wait(5000);
        const variables = buildSupplierVariables(registrationNumber);
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: queries.suppliers, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const supplier = response.body.data.suppliers;
            expect(supplier.edges.length).to.eq(1);
            const node = supplier.edges[0].node;
            expect(node).to.have.all.keys(PropertiesMW.suppliers);
            expect(node.active).to.eq(false);
        });
    });

    it('Should activate a supplier in MailShip', {
        retries
    }, () => {
        cy.request({
            url: `${urlMailShip}${Endpoints.MAILSHIP_SUPPLIER_ACTIVATE}/${msSupplierId}`,
            method: 'PUT',
            headers: msHeaders
        }).then((response) => {
            expect(response).to.have.property('status', 204);
        });
    });

    it('Should return a supplier in MailWise activated in MailShip', {
        retries
    }, () => {
        cy.wait(5000);
        const variables = buildSupplierVariables(registrationNumber);
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: queries.suppliers, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const supplier = response.body.data.suppliers;
            expect(supplier.edges.length).to.eq(1);
            const node = supplier.edges[0].node;
            expect(node).to.have.all.keys(PropertiesMW.suppliers);
            expect(node.active).to.eq(true);
        });
    });

    it('Should delete supplier in MailShip', {
        retries
    }, () => {
        cy.request({
            url: `${urlMailShip}${Endpoints.MAILSHIP_SUPPLIER}/${msSupplierId}`,
            method: 'DELETE',
            headers: msHeaders
        }).then((response) => {
            expect(response).to.have.property('status', 204);
        })
    });

    it('Should return a supplier in MailWise', {
        retries
    }, () => {
        cy.wait(5000);
        const variables = buildSupplierVariables(registrationNumber);
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: mwHeaders,
            body: { query: queries.suppliers, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const supplier = response.body.data.suppliers;
            expect(supplier.edges.length).to.eq(1);
            const node = supplier.edges[0].node;
            expect(node).to.have.all.keys(PropertiesMW.suppliers);
        });
    });
});