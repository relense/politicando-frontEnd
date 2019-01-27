import React, { Component, Fragment } from 'react';
import { connect } from 'react-redux';
import './PartyHeader.css';
import { asyncChangePartyView } from '../../redux/actions/viewActions.js';
import { renderLogo } from '../../utils/UtilFunctions.js';

class PartyHeader extends Component {
  
  checkDarkMode(partyView){
    let classNameString = "";
    let selected = "";
    let notSelected = "";

    if(this.props.darkMode) {
      selected = 'buttonsSelectedDarkMode';
      notSelected = 'buttonsDarkMode';
    } else {
      selected = 'buttonsSelectedLightMode';
      notSelected = 'buttonsLightMode';
    }

    if(this.props.partyView === partyView)
      classNameString = selected + ' partieElems';    
    else 
      classNameString = notSelected + ' partieElems';
    
    return classNameString;
  }

  render() {
    let condition = this.props.partieNews !== null ? this.props.currentPartie.party_name !== undefined : false;
    let logo = condition ? renderLogo(this.props.currentPartie.party_name) : "";

    let logo2 = (
      <div className="partyHeaderLogoContainer">
        <img src={ require(`../../images/${logo.imageName}`)} style={logo.partieLogo} alt={this.props.currentPartie.description} />
      </div>
    );

    return (
        <div className="partieHeaderContent">
        {condition &&
          <Fragment>
            {logo2}
          </Fragment>
        }
        </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    currentPartie: state.parties.currentPartie,
    partyView: state.view.partyView,
    darkMode: state.view.darkMode
  };
}

function mapDispatchToProps(dispatch) {
  return {
    setPartyView: (view) => {
      dispatch(asyncChangePartyView(view))
    }
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(PartyHeader);
