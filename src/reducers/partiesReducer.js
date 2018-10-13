import { FETCH_PARTIES, RECEIVE_PARTIES, CHANGE_CURRENT_PARTIE } from '../actions/actionTypes';

const initialState = {
    partieList: [],
    currentPartie: ""
}

export default function parties(state = initialState, action) {
  switch (action.type) {
    case FETCH_PARTIES:
      return action;

    case RECEIVE_PARTIES:
      return {
        ...state,
        partieList: action.parties
      }

    case CHANGE_CURRENT_PARTIE:
      return {
        ...state,
        currentPartie: action.partie
      }

    default:
      return state;
  }
}
