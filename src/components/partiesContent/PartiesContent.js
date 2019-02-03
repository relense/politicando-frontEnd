import React, { Component } from 'react';
import { connect } from 'react-redux';
import './PartiesContent.css';
import PartieInformation from '../partieInformation/PartieInformation';
import { asyncCloseDrawer } from '../../redux/actions/viewActions';
import { checkDarkModeBackground } from '../../utils/CheckDarkMode.js';
import { asyncChangeView } from '../../redux/actions/viewActions';
import { loadParties, asyncChangeCurrentPartie, asyncGetPartieNews } from '../../redux/actions/partiesActions';

class PartiesContent extends Component {
  componentWillMount() {
    if(this.props.parties.length === 0){
      this.props.fetchParties();
    }  
  }

  componentDidUpdate(prevProps) {
    if (this.props.parties !== prevProps.parties) {
      for(var i = 0; i < this.props.parties.length; i++) {
        if (this.props.name.toUpperCase() === this.props.parties[i].party_name) {
          this.props.changeView("PARTIES");
          this.props.changeCurrentPartie(this.props.parties[i]);
          this.props.getPartieNews(this.props.parties[i].id)
          window.scrollTo(0, 0)
          return;
        }
      }
    }
  }

  render() {
    return(
      <div className={(this.props.drawer ? 'mainContainerDark' : '') + checkDarkModeBackground(this.props.darkMode)} onClick={() => this.props.closeDrawer()}>
        <div className={this.props.drawer ? 'removeLinks' : ''}>
          <PartieInformation />
        </div>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    parties: state.parties.partieList,
    drawer: state.view.drawer,
    darkMode: state.view.darkMode,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    fetchParties: () => {
      dispatch(loadParties())
    },
    changeView: (view) => {
      dispatch(asyncChangeView(view))
    },
    changeCurrentPartie: (partie) => {
      dispatch(asyncChangeCurrentPartie(partie))
    },
    getPartieNews: (partie_id) => {
      dispatch(asyncGetPartieNews(partie_id))
    },
    closeDrawer: () => {
      dispatch(asyncCloseDrawer());
    }
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(PartiesContent);
