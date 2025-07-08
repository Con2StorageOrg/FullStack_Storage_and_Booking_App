import { describe, expect } from "@jest/globals";
import {
  calculateDuration,
  dayDiffFromToday,
  getUniqueLocationIDs,
} from "../../src/utils/booking.utils";
import { UserBooking } from "src/modules/booking/types/booking.interface";

describe("getUniqueLocationIDs", () => {
  it("removes duplicate from the same order_items array", () => {
    const testValueA: UserBooking[] = [
      {
        booking_items: [
          {
            storage_items: {
              location_id: "helsinki",
            },
          },
          {
            storage_items: {
              location_id: "stockholm",
            },
          },
          {
            storage_items: {
              location_id: "stockholm",
            },
          },
        ],
      },
    ];

    expect(getUniqueLocationIDs(testValueA)).toStrictEqual([
      "helsinki",
      "stockholm",
    ]);
  });
  it("removes duplicate from different orders", () => {
    const testValueA: UserBooking[] = [
      {
        booking_items: [
          {
            storage_items: {
              location_id: "helsinki",
            },
          },
        ],
      },
      {
        booking_items: [
          {
            storage_items: {
              location_id: "stockholm",
            },
          },
        ],
      },
      {
        booking_items: [
          {
            storage_items: {
              location_id: "stockholm",
            },
          },
        ],
      },
    ];

    expect(getUniqueLocationIDs(testValueA)).toStrictEqual([
      "helsinki",
      "stockholm",
    ]);
  });
});

describe("dayDiffFromToday", () => {
  const testDate = new Date();
  const todaysDate = new Date();

  it("5 days before today should return -5", () => {
    const expected = -5;
    testDate.setDate(todaysDate.getDate() + expected);
    expect(dayDiffFromToday(testDate)).toEqual(expected);
  });
  it("5 days after today should return 5", () => {
    const expected = 5;
    testDate.setDate(todaysDate.getDate() + expected);
    expect(dayDiffFromToday(testDate)).toEqual(expected);
  });
});

describe("calculateDuration", () => {
  it("Days between May 5th and May 25th should return 20", () => {
    const startDate = new Date("2025-05-05");
    const endDate = new Date("2025-05-25");

    expect(calculateDuration(startDate, endDate)).toEqual(20);
  });

  it("Days between May 5th 2024 and May 5th 2025 should return 365", () => {
    const startDate = new Date("2024-05-05");
    const endDate = new Date("2025-05-05");

    expect(calculateDuration(startDate, endDate)).toEqual(365);
  });

  it("Days between May 25th and May 5th should return -20", () => {
    const startDate = new Date("2025-05-05");
    const endDate = new Date("2025-05-25");

    expect(calculateDuration(endDate, startDate)).toEqual(-20);
  });
});
