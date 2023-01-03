import { PropertiesMW } from '../../support/constants/propertiesMailWise';
import moment from 'moment';
const urlMailWise = Cypress.config('urlMailWise');
const userMailWise = Cypress.config('userMailWise');
const queries = require('../../fixtures/mailwise/queries.json');
const mutations = require('../../fixtures/mailwise/mutations.json');

let headers = null;
let tokenMailWise = null;

describe('Organisation test', () => { //[MW-1794]
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
    const prefix = 'PACK';
    const retries = {
        runMode: 2,
        openMode: 2
    };
    const packagingToCheck = {
        packagingCode: null,
        packagingName: null,
        packagingType: null,
        packagingHeight: null,
        packagingWidth: null,
        packagingLength: null,
        packagingWeight: null
    };
    const buildPackagingVariables = (packagingId) => {
        const variables = {
            filter: [
                {
                    id: {
                        eq: packagingId
                    }
                }
            ]
        }
        return variables;
    };
    let packagingId = null;

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
            headers: headers,
            body: { query: mutations.packagingCreate, variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const packaging = response.body.data.packagingCreate.packaging;
            expect(packaging).to.have.key('id');
            packagingId = packaging.id;
            packagingToCheck.packagingCode = variables.code;
            packagingToCheck.packagingName = variables.name;
            packagingToCheck.packagingType = variables.type;
            packagingToCheck.packagingHeight = variables.height;
            packagingToCheck.packagingWidth = variables.width;
            packagingToCheck.packagingLength = variables.length;
            packagingToCheck.packagingWeight = variables.weight;
        });
    });

    it('Should return a created packaging in MailWise', () => {
        const variables = buildPackagingVariables(packagingId);
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers,
            body: { query: queries.packagings, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const packagings = response.body.data.packagings;
            const result = packagings.edges[0];
            expect(packagings.edges.length).to.eq(1);
            expect(packagings).to.have.all.keys('pageInfo', 'totalCount', 'edges');
            expect(result).to.have.all.keys('cursor', 'node');
            expect(result.node).to.have.all.keys(PropertiesMW.packagings);
            const node = result.node;
            expect(node.code).to.eq(packagingToCheck.packagingCode);
            expect(node.name).to.eq(packagingToCheck.packagingName);
            expect(node.type).to.eq(packagingToCheck.packagingType);
            expect(node.height).to.eq(packagingToCheck.packagingHeight);
            expect(node.width).to.eq(packagingToCheck.packagingWidth);
            expect(node.length).to.eq(packagingToCheck.packagingLength);
            expect(node.weight).to.eq(packagingToCheck.packagingWeight);
            packagingId = node.id;
        });
    });

    it('Should update a packaging in MailWise', () => {
        const variables = {
            id: packagingId,
            code: `${prefix}${cy.faker.random.number(max)}`,
            name: cy.faker.lorem.word(),
            type: "Medium box",
            height: cy.faker.random.number(max),
            width: cy.faker.random.number(max),
            length: cy.faker.random.number(max),
            weight: cy.faker.random.number(max),
            createdAt: moment().format(),
            changedAt: moment().format()
        };
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers,
            body: { query: mutations.packagingUpdate, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const packaging = response.body.data.packagingUpdate.packaging;
            expect(packaging).to.have.key('id');
            expect(packaging.id).to.eq(packagingId);
            packagingId = packaging.id;
            packagingToCheck.packagingCode = variables.code;
            packagingToCheck.packagingName = variables.name;
            packagingToCheck.packagingType = variables.type;
            packagingToCheck.packagingHeight = variables.height;
            packagingToCheck.packagingWidth = variables.width;
            packagingToCheck.packagingLength = variables.length;
            packagingToCheck.packagingWeight = variables.weight;
        });
    });

    it('Should return updated packaging in MailWise', () => {
        const variables = buildPackagingVariables(packagingId);
        cy.request({
            method: 'POST',
            url: urlMailWise,
            headers,
            body: { query: queries.packagings, variables: variables },
            failOnStatusCode: false
        }).then(response => {
            expect(response).to.have.property('status', 200);
            const packagings = response.body.data.packagings;
            const result = packagings.edges[0];
            expect(packagings.edges.length).to.eq(1);
            expect(packagings).to.have.all.keys('pageInfo', 'totalCount', 'edges');
            expect(result).to.have.all.keys('cursor', 'node');
            expect(result.node).to.have.all.keys(PropertiesMW.packagings);
            const node = result.node;
            expect(node.id).to.eq(packagingId);
            expect(node.code).to.eq(packagingToCheck.packagingCode);
            expect(node.name).to.eq(packagingToCheck.packagingName);
            expect(node.type).to.eq(packagingToCheck.packagingType);
            expect(node.height).to.eq(packagingToCheck.packagingHeight);
            expect(node.width).to.eq(packagingToCheck.packagingWidth);
            expect(node.length).to.eq(packagingToCheck.packagingLength);
            expect(node.weight).to.eq(packagingToCheck.packagingWeight);
        });
    });
});