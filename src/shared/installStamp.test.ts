import { describe, expect, test } from "bun:test";
import { installStampOf } from "./installStamp";

describe("reading the install stamp the rcon password lives in", () => {
	test("reads back the build and the password the install wrote", () => {
		expect(
			installStampOf({
				buildId: "12345",
				rconPassword: "secret",
			}),
		).toEqual({
			buildId: "12345",
			rconPassword: "secret",
		});
	});

	test("counts a stamp with no password as absent, because rcon cannot be reached without one", () => {
		expect(installStampOf({})).toBeNull();
	});

	test("counts an empty password as absent rather than dialling rcon with it", () => {
		expect(
			installStampOf({
				rconPassword: "",
			}),
		).toBeNull();
	});

	test("counts a password of the wrong type as absent", () => {
		expect(
			installStampOf({
				rconPassword: 1234,
			}),
		).toBeNull();
	});

	test("reads a missing file as no stamp at all", () => {
		expect(installStampOf(null)).toBeNull();
	});

	test("reads a stamp written before the first build was known", () => {
		expect(
			installStampOf({
				buildId: null,
				rconPassword: "secret",
			})?.buildId,
		).toBeNull();
	});
});
