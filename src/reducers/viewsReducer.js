import { SET_VIEW, SET_PARTY_VIEW, OPEN_DRAWER, CLOSE_DRAWER } from '../actions/actionTypes';

const initialState = {
    currentView: "HOME",
    partyView: "NOTICIAS",
    drawer: false
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

    case CLOSE_DRAWER:
      return {
        ...state,
        drawer: false
      }
    
    case OPEN_DRAWER:
      return {
        ...state,
        drawer: true
      }

    default:
      return state;
  }
}
