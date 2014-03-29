/*
 * Copyright (c) 2014 Adobe Systems Incorporated. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 *
 */

/*jslint vars: true, plusplus: true, devel: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, describe, it, expect, beforeEach, afterEach, waits, waitsFor, runs, $, brackets, waitsForDone, spyOn, KeyEvent */

define(function (require, exports, module) {
    "use strict";

    // Modules from the SpecRunner window
    var SpecRunnerUtils             = brackets.getModule("spec/SpecRunnerUtils"),
        KeyEvent                    = brackets.getModule("utils/KeyEvent"),
        testContentMatchPositive    = require("text!unittest-files/match-positive.css"),
        testContentMatchNegative    = require("text!unittest-files/match-negative.css"),
        testContentMatchEmbedded    = require("text!unittest-files/match-embedded.html"),
        main                        = require("main");

    describe("CSS Shapes Editor", function(){
        var testDocument, testEditor;

        function constructModelAtPos (row, col) {
            testEditor.setCursorPos(row, col);
            // mutates main.model
            main._constructModel({ target: testEditor });
        }

        /*
          Quick test for shape-like values in Brackets.

          Actual shape conformity is tested by the thirdparty CSSShapesEditor.js
          It will throw errors for invalid shapes; to be caught by the Brackets extension.
        */
        describe('Positive match CSS Shapes-like values', function(){

            beforeEach(function () {
                var mock = SpecRunnerUtils.createMockEditor(testContentMatchPositive, "css");
                testDocument = mock.doc;
                testEditor = mock.editor;
            });

            afterEach(function () {
                SpecRunnerUtils.destroyMockEditor(testDocument);
                testEditor = null;
                testDocument = null;
            });

            it('should have a default model', function(){
                expect(main.model).toBeDefined();
                expect(main.model.get('property')).toBe(null);
                expect(main.model.get('value')).toBe(null);
                expect(main.model.get('selector')).toBe(null);
            })

            it("should match shape-inside property", function () {
                constructModelAtPos(3, 20);
                expect(main.model.get('property')).toBe('shape-inside');
            });

            it("should not match property or value when cursor is after semicolon", function () {
                constructModelAtPos(3, 28);
                expect(main.model.get('property')).not.toBe('shape-inside');
                expect(main.model.get('value')).not.toBe('circle()');
            });

            it("should match shape-outside property", function () {
                constructModelAtPos(4, 21);
                expect(main.model.get('property')).toBe('shape-outside');
            });

            it("should match clip-path property", function () {
                constructModelAtPos(5, 17);
                expect(main.model.get('property')).toBe('clip-path');
            });

            it("should match empty circle() value", function () {
                constructModelAtPos(6, 20);
                expect(main.model.get('value')).toBe('circle()');
            });

            it("should match circle() value", function () {
                constructModelAtPos(7, 20);
                expect(main.model.get('value')).toBe('circle(0 at 0 0)');
            });

            it("should match circle() value when cursor is inside function", function () {
                constructModelAtPos(7, 27);
                expect(main.model.get('value')).toBe('circle(0 at 0 0)');
            });

            it("should match circle() value with pixel units", function () {
                constructModelAtPos(8, 27);
                expect(main.model.get('value')).toBe('circle(0px at 0px 0px)');
            });

            it("should match circle() value with mixed units", function () {
                constructModelAtPos(9, 27);
                expect(main.model.get('value')).toBe('circle(0px at 0 0%)');
            });

            it("should match empty ellipse() value", function () {
                constructModelAtPos(10, 27);
                expect(main.model.get('value')).toBe('ellipse()');
            });

            it("should match ellipse() value", function () {
                constructModelAtPos(11, 27);
                expect(main.model.get('value')).toBe('ellipse(0 0 at 0 0)');
            });

            // Incomplete values should not trip the Brackets side.
            // The in-browser CSS Shapes Editor must reject invalid values
            it("should match incomplete ellipse() value", function () {
                constructModelAtPos(12, 27);
                expect(main.model.get('value')).toBe('ellipse(0 0)');
            });

            it("should match empty polygon()", function () {
                constructModelAtPos(13, 27);
                expect(main.model.get('value')).toBe('polygon()');
            });

            it("should match polygon() value", function () {
                constructModelAtPos(14, 27);
                expect(main.model.get('value')).toBe('polygon(0 0, 100px 0, 100px 100px)');
            });

            it("should match polygon() value with fill-rule", function () {
                constructModelAtPos(15, 27);
                expect(main.model.get('value')).toBe('polygon(nonzero, 0 0, 100px 0, 100px 100px)');
            });
        });

        describe('Negative match CSS Shapes-like values', function(){

            beforeEach(function () {
                var mock = SpecRunnerUtils.createMockEditor(testContentMatchNegative, "css");
                testDocument = mock.doc;
                testEditor = mock.editor;
            });

            afterEach(function () {
                SpecRunnerUtils.destroyMockEditor(testDocument);
                testEditor = null;
                testDocument = null;
            });

            it("should not match prefixed shape-inside property", function () {
                constructModelAtPos(1, 27);
                expect(main.model.get('property')).not.toBe('-webkit-shape-inside');
            });

            it("should not match commented-out shape-inside property", function () {
                constructModelAtPos(2, 27);
                expect(main.model.get('property')).not.toBe('shape-inside');
            });

            it("should not match non-functional value", function () {
                constructModelAtPos(3, 27);
                expect(main.model.get('value')).not.toBe('circle');
                expect(main.model.get('value')).toBe(null);
            });

            it("should not match polygon-like value", function () {
                constructModelAtPos(4, 27);
                expect(main.model.get('value')).not.toBe('fake-polygon()');
            });
        });

        describe('Find selector in embedded <style> blocks', function(){

            beforeEach(function () {
                var mock = SpecRunnerUtils.createMockEditor(testContentMatchEmbedded, "html");
                testDocument = mock.doc;
                testEditor = mock.editor;
            });

            afterEach(function () {
                SpecRunnerUtils.destroyMockEditor(testDocument);
                testEditor = null;
                testDocument = null;
            });

            it("should find first selector in head <style>", function () {
                constructModelAtPos(4, 20);
                expect(main.model.get('selector')).toBe('#content');
            });

            it("should find second selector in head <style>", function () {
                constructModelAtPos(8, 20);
                expect(main.model.get('selector')).toBe('div');
            });

            it("should find first selector in body <style>", function () {
                constructModelAtPos(15, 22);
                expect(main.model.get('selector')).toBe('#content');
            });

            it("should find first selector in scoped <style>", function () {
                constructModelAtPos(21, 22);
                expect(main.model.get('selector')).toBe('#content');
            });

        });
    });
});
