import { PropertiesMW } from '../../support/constants/propertiesMailWise';
import moment from 'moment';
const urlMailWise = Cypress.config('urlMailWise');
const userMailWise = Cypress.config('userMailWise');
const queries = require('../../fixtures/mailwise/queries.json');
const mutations = require('../../fixtures/mailwise/mutations.json');
const locationBoxVariables = require(`../../fixtures/intMailWise/intLocationBoxCreate-${Cypress.env('version')}.json`);

let headers = null;
let tokenMailWise = null;

describe('Organisation test', () => { //[MW-1757]
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
    let locationId = null;
    let locationCode = null;

    it('Should create a location in MailWise', () => {
        const variables = {
            ...locationBoxVariables,
            code: cy.faker.lorem.words()
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers: headers,
            body: { query: mutations.locationCreate, variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const location = response.body.data.locationCreate.location;
            expect(location).to.have.all.keys(PropertiesMW.location);
            cy.log(`status = ${response.status} with locationId = ${location.id}`);
            locationId = location.id;
            locationCode = location.code;
        });
    });

    it('Should return a created location in MailWise', () => {
        const variables = {
            filter: [
                {
                    id: {
                        eq: locationId
                    }
                }
            ]
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers,
            body: { query: queries.locations, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const locations = response.body.data.locations;
            const result = locations.edges[0];
            expect(locations.edges.length).to.eq(1);
            expect(locations).to.have.all.keys('pageInfo', 'totalCount', 'edges');
            expect(result).to.have.all.keys('cursor', 'node');
            cy.log(JSON.stringify(result.node));
            expect(result.node).to.have.all.keys(PropertiesMW.locations);
            locationId = result.node.id;
            locationCode = result.node.code;
        });
    });

    it('Should update a location in MailWise', () => {
        const variables = {
            id: locationId,
            allowVariousStores: true,
            active: true,
            areaId: locationBoxVariables.areaId,
            parentId: locationBoxVariables.parentId,
            locked: false,
            code: locationCode,
            type: 'PICKING',
            turnover: 'C',
            sizeType: 'LARGE',
            createdAt: moment().format(),
            changedAt: null,
            width: cy.faker.random.number(max),
            height: cy.faker.random.number(max),
            length: cy.faker.random.number(max),
            maxLoad: cy.faker.random.number(max),
            maxSkuLimit: null,
            bline: null,
            color: '#FFFFFF',
            area: {
                id: locationBoxVariables.areaId,
                code: 'PALLETS'
            }
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers,
            body: { query: mutations.locationUpdate, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const location = response.body.data.locationUpdate.location;
            expect(location).to.have.all.keys(PropertiesMW.location);
            expect(location.id).to.eq(locationId);
            expect(location.type).to.eq(variables.type);
            expect(location.turnover).to.eq(variables.turnover);
            expect(location.sizeType).to.eq(variables.sizeType);
            expect(location.width).to.eq(variables.width);
            expect(location.height).to.eq(variables.height);
            expect(location.length).to.eq(variables.length);
            expect(location.height).to.eq(variables.height);
        });
    });

    it('Should deactivate a location in MailWise', () => {
        const variables = {
            id: locationId
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers,
            body: { query: mutations.locationDeactivate, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const location = response.body.data.locationDeactivate.location;
            expect(location).to.have.all.keys(PropertiesMW.location);
            expect(location.id).to.eq(locationId);
            expect(location.active).to.eq(false);
        });
    });

    it('Should activate a location in MailWise', () => {
        const variables = {
            id: locationId
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers,
            body: { query: mutations.locationActivate, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const location = response.body.data.locationActivate.location;
            expect(location).to.have.all.keys(PropertiesMW.location);
            expect(location.id).to.eq(locationId);
            expect(location.active).to.eq(true);
        });
    });
});