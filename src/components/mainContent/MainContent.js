import React, { Component } from 'react';
import { connect } from 'react-redux';
import './MainContent.css';
import PartieInformation from '../partieInformation/PartieInformation';
import PartyCouncilman from '../partyCouncilman/PartyCouncilman';
import LatestNews from '../latestNews/LatestNews';
import { asyncCloseDrawer } from '../../actions/viewActions';

class MainContent extends Component {
  getView = () => {
    switch(this.props.currentView) {
      case "HOME":
        return (
          <div className={this.props.drawer ? 'mainContainerDark' : 'mainContainer'} onClick={() => this.props.closeDrawer()}>
            <div className="spacingAdjustment"></div>
            <div className={this.props.drawer ? 'removeLinks' : ''}>
              <LatestNews articles={this.props.articles} />
            </div>
          </div>
        )

      case "PARTIES":
          if (this.props.partyView === "NOTICIAS") {
            return (
              <div className={this.props.drawer ? 'mainContainerDark' : 'mainContainer'} onClick={() => this.props.closeDrawer()}>                                                    
                <div className={this.props.drawer ? 'removeLinks' : ''}>
                <PartieInformation />
                </div>
              </div>
            )
          } else {
            return (
              <div className={this.props.drawer ? 'mainContainerDark' : 'mainContainer'} onClick={() => this.props.closeDrawer()}>
                <div className={this.props.drawer ? 'removeLinks' : ''}>
                  <PartyCouncilman />
                </div>
              </div>
            )
          }

      case "ABOUT":
          return (
            <div className={this.props.drawer ? 'mainContainerDark' : 'mainContainer'} onClick={() => this.props.closeDrawer()}>
              <div className="spacingAdjustment"></div>
            </div>
          )

      default:
        return (
          <div className={this.props.drawer ? 'mainContainerDark' : 'mainContainer'} onClick={() => this.props.closeDrawer()}>
            <div className="mainContainer">
              <div className="spacingAdjustment"></div>
              <div className={this.props.drawer ? 'removeLinks' : ''}>
               <LatestNews articles={this.props.articles} />
              </div>
            </div>
          </div>
        )
    }
  }

  render() {
    return (
        this.getView()
    );
  }
}

function mapStateToProps(state) {
  return {
    currentView: state.view.currentView,
    articles: state.articles.all_articles,
    partyView: state.view.partyView,
    drawer: state.view.drawer
  };
}

function mapDispatchToProps(dispatch) {
  return { 
    closeDrawer: () => {
      dispatch(asyncCloseDrawer());
    }
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(MainContent);
