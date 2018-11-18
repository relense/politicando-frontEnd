import { SET_VIEW, SET_PARTY_VIEW } from '../actions/actionTypes';

const initialState = {
    currentView: "HOME",
    partyView: "NOTICIAS"
}

export default function view(state = initialState, action) {
  switch (action.type) {
    case SET_VIEW:
      return {
        ...state,
        currentView: action.view
      }
    
    case SET_PARTY_VIEW:
      return {
        ...state,
        partyView: action.partyView
      }

    default:
      return state;
  }
}
