import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { RootState } from "../store";
import { LocationDetails } from "@/types";
import { locationsApi } from "../../api/services/locations";

// Define the state interface
interface LocationsState {
  locations: LocationDetails[];
  total: number;
  page: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
}

const initialState: LocationsState = {
  locations: [],
  total: 0,
  page: 1,
  totalPages: 1,
  loading: false,
  error: null,
};

// Async thunk to fetch all locations
export const fetchAllLocations = createAsyncThunk(
  "locations/fetchAll",
  async (
    { page = 1, limit = 10 }: { page?: number; limit?: number } = {},
    { rejectWithValue },
  ) => {
    try {
      return await locationsApi.getAllLocations(page, limit);
    } catch (error: unknown) {
      let errorMessage = "Failed to fetch locations";

      if (error && typeof error === "object" && "response" in error) {
        const typedError = error as {
          response?: {
            data?: {
              message?: string;
            };
          };
        };
        if (typedError.response?.data?.message) {
          errorMessage = typedError.response.data.message;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
      }

      return rejectWithValue(errorMessage);
    }
  },
);

// Create the locations slice
const locationsSlice = createSlice({
  name: "locations",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAllLocations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllLocations.fulfilled, (state, action) => {
        state.loading = false;
        state.locations = action.payload.data;
        state.total = action.payload.total;
        state.page = action.payload.page;
        state.totalPages = action.payload.totalPages;
      })
      .addCase(fetchAllLocations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

// Selectors
export const selectAllLocations = (state: RootState) =>
  state.locations.locations;
export const selectLocationsLoading = (state: RootState) =>
  state.locations.loading;
export const selectLocationsError = (state: RootState) => state.locations.error;

export default locationsSlice.reducer;
