import { PropertiesMW } from '../../support/constants/propertiesMailWise';
import moment from 'moment';
const urlMailWise = Cypress.config('urlMailWise');
const userMailWise = Cypress.config('userMailWise');
const queries = require('../../fixtures/mailwise/queries.json');
const mutations = require('../../fixtures/mailwise/mutations.json');

let headers = null;
let tokenMailWise = null;

describe('Organisation test', () => { //[MW-1218]
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
    let mailshipId = null;

    it('Should create organisation in MailWise', () => {
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
            expect(dataItem).to.have.all.keys(PropertiesMW.organisation);
            cy.log(`status = ${response.status} with organisationId = ${dataItem.id}`);
            organisationId = dataItem.id;
            organisationName = dataItem.name;
        });
    });

    it('Should return a created organisation in MailWise', () => {
        const variables = {
            filter: [
                {
                    id: {
                        eq: organisationId
                    }
                }
            ]
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers,
            body: { query: queries.organisations, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const dataItem = response.body.data.organisations;
            const result = dataItem.edges[0];
            expect(dataItem.edges.length).to.eq(1);
            expect(dataItem).to.have.all.keys('pageInfo', 'totalCount', 'edges');
            expect(result).to.have.all.keys('cursor', 'node');
            expect(result.node).to.have.all.keys(PropertiesMW.organisation);
            cy.log(`status = ${response.status} with organisationId = ${result.node.id}`);
            organisationId = result.node.id;
            organisationName = result.node.name;
            mailshipId = result.node.mailshipId;
        });
    });

    it('Should update a organisation in MailWise', () => {
        const variables = {
            id: organisationId,
            allowUserEditSku: false,
            readableId: 'CZ',
            name: organisationName,
            senderName: null,
            senderPhone: cy.faker.phone.phoneNumber(),
            senderEmail: cy.faker.internet.email(),
            vatNumber: `${prefix}${cy.faker.random.number(max)}`,
            registrationNumber: `${prefix}${cy.faker.random.number(max)}`,
            country: 'CZ',
            active: true,
            inMicropost: true,
            changedAt: null,
            createdAt: moment().format(),
            addressLine1: cy.faker.address.cityName(),
            addressLine2: null,
            addressLine3: null,
            mailshipId: mailshipId,
            micropostUrl: null,
            micropostClientId: null,
            micropostLoginName: null,
            micropostNewSubTypeId: null,
            micropostPassword: null,
            micropostReceiptTypeId: null,
            micropostReturnTypeId: null,
            micropostReturnedDamagedSubTypeId: null,
            micropostReturnedOpenSubTypeId: null,
            micropostReturnedSubTypeId: null,
            productMeasuresMandatory: false,
            tmsCustomerId: `${prefix}${cy.faker.random.number(max)}`,
            useInternalData: null
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers,
            body: { query: mutations.organisationUpdate, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const dataItem = response.body.data.organisationUpdate.organisation;
            expect(dataItem).to.have.all.keys(PropertiesMW.organisation);
            expect(dataItem.id).to.eq(organisationId);
            expect(dataItem.senderPhone).to.eq(variables.senderPhone);
            expect(dataItem.senderEmail).to.eq(variables.senderEmail);
            expect(dataItem.vatNumber).to.eq(variables.vatNumber);
            expect(dataItem.registrationNumber).to.eq(variables.registrationNumber);
            expect(dataItem.tmsCustomerId).to.eq(variables.tmsCustomerId);
        });
    });
});