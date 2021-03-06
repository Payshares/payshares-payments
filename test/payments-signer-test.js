var helper      = require("./test-helper");
var Promise     = require("bluebird");
var _           = require("lodash");

var request     = Promise.promisify(require('request'));
var assert      = require('assert');
var sinon       = require('sinon');

var PaysharesdStubby  = require('./paysharesd-stubby');
var PaymentsSigner  = require('../lib/signer');
var Database        = require('../lib/database');

var sandbox = sinon.sandbox.create();

// The signer object we'll be testing
var signer;

describe("signer tests", function () {
    afterEach(function () {
        sandbox.restore();
    });
    describe("signTransaction()" ,function () {
        var STARTING_SEQUENCE_NUMBER = 1;

        var networkStubby;
        var networkMock;
        var databaseMock;

        beforeEach(function (done) {
            networkStubby = new PaysharesdStubby();
            var config = _.assign(helper.config, {
                network: networkStubby,
                logger: helper.logger
            });
            var database = new Database({connection: helper.db, logger: helper.logger});
            networkMock = sandbox.mock(networkStubby.PaysharesdStubbyMock);
            databaseMock = sandbox.mock(database);

            signer = new PaymentsSigner(helper.config, database, networkStubby);
            signer.setSequenceNumber(STARTING_SEQUENCE_NUMBER);

            done();
        });

        afterEach(function (done) {
            sandbox.restore();
            done();
        });

        describe("signs a good transaction", function () {
            beforeEach(function (done) {
                var goodTx = {
                    id: 1,
                    address: "gUtH4rCNEGPWke3PzDnJ3E7mozcsuXJTAf",
                    amount: 1
                };

                var storeSignedTransactionExpectation = databaseMock.expects("storeSignedTransaction").once();

                signer.signTransaction(goodTx)
                    .then(done);
            });

            it("should store the transaction", function (done) {
                databaseMock.verify();
                done();
            });

            it("should increment the sequence number", function (done) {
                assert.equal(signer.sequenceNumber, STARTING_SEQUENCE_NUMBER + 1);
                done();
            });
        });

        describe("signs a bad transaction", function () {
            var markTransactionErrorExpectation;
            beforeEach(function (done) {
                var badTx = {
                    id: 1,
                    address: "malformed",
                    amount: 1
                };
                markTransactionErrorExpectation = databaseMock.expects("markTransactionError").once();

                signer.signTransaction(badTx)
                    // TODO: remove when signing errors are no longer fatal
                    .catch(function() {
                        done();
                    });
            });

            /** TODO: remove comments when signing errors are no longer fatal
            it("should store the transaction error", function (done) {
                markTransactionErrorExpectation.verify();
                done();
            });
            */

            it("should not increment the sequence number", function (done) {
                assert.equal(signer.sequenceNumber, STARTING_SEQUENCE_NUMBER);
                done();
            });
        });

        describe("signs a multi currency transaction", function () {
            var signPaymentTransactionSpy;
            beforeEach(function (done) {
                var multiCurrencyTx = {
                    id: 1,
                    address: "gUtXaF5wdpiT9wcdKpt9GMwF6cNSoW2Jsw",
                    amount: 1,
                    currency: "USD",
                    issuer: "gM3a41VDi7fBj8EZBqnBGkGPGz4idBquro"
                }

                signPaymentTransactionSpy = sandbox.spy(signer, "signPaymentTransaction");
                signer.signTransaction(multiCurrencyTx)
                    .then(done);
            });

            it("should call with amount object", function (done) {
                var amountObj = {
                    value: "1",
                    currency: "USD",
                    issuer: "gM3a41VDi7fBj8EZBqnBGkGPGz4idBquro"
                };
                var args = signPaymentTransactionSpy.args[0];
                assert(_.isEqual(amountObj, args[3]));
                done();
            });
        });
    });
});